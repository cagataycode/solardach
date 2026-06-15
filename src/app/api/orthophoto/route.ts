import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeLod2 } from "@/services/lod2";

/**
 * Aerial orthophoto (NRW DOP, 10 cm, open data dl-de/zero-2-0) for a property
 * check, centered exactly on the 3D scene origin so the client can drape it
 * onto the ground plane and roof surfaces. Proxied server-side (no CORS,
 * cacheable) and cached on disk.
 */
const WMS_URL = "https://www.wms.nrw.de/geobasis/wms_nw_dop";
const CACHE_DIR = join(process.cwd(), "data", "dop-cache");
const IMAGE_PX = 1536;
const MIN_SIZE_M = 60;
const MAX_SIZE_M = 400;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const checkId = url.searchParams.get("checkId");
  const sizeM = Math.min(
    Math.max(Number(url.searchParams.get("size") ?? 220), MIN_SIZE_M),
    MAX_SIZE_M
  );
  if (!checkId) {
    return NextResponse.json({ error: "checkId fehlt." }, { status: 400 });
  }

  const check = await db.propertyCheck.findUnique({ where: { id: checkId } });
  if (!check) {
    return NextResponse.json({ error: "Anfrage nicht gefunden." }, { status: 404 });
  }

  const analysis = await analyzeLod2(check.latitude, check.longitude).catch(
    () => null
  );
  if (!analysis) {
    return NextResponse.json({ error: "Kein Luftbild verfügbar." }, { status: 404 });
  }

  const { easting, northing } = analysis.originUtm;
  const cacheKey = `dop_${Math.round(easting)}_${Math.round(northing)}_${sizeM}.jpg`;
  const cachePath = join(CACHE_DIR, cacheKey);

  let jpeg: Buffer;
  try {
    jpeg = await readFile(cachePath);
  } catch {
    const half = sizeM / 2;
    const wms = new URL(WMS_URL);
    wms.searchParams.set("SERVICE", "WMS");
    wms.searchParams.set("REQUEST", "GetMap");
    wms.searchParams.set("VERSION", "1.3.0");
    wms.searchParams.set("LAYERS", "nw_dop_rgb");
    wms.searchParams.set("STYLES", "");
    wms.searchParams.set("CRS", "EPSG:25832");
    wms.searchParams.set(
      "BBOX",
      [easting - half, northing - half, easting + half, northing + half].join(",")
    );
    wms.searchParams.set("WIDTH", String(IMAGE_PX));
    wms.searchParams.set("HEIGHT", String(IMAGE_PX));
    wms.searchParams.set("FORMAT", "image/jpeg");

    const res = await fetch(wms, {
      headers: { "User-Agent": "solar-dach-mvp/0.1" },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("image")) {
      return NextResponse.json(
        { error: "Luftbild-Dienst nicht erreichbar." },
        { status: 502 }
      );
    }
    jpeg = Buffer.from(await res.arrayBuffer());
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cachePath, jpeg);
  }

  return new NextResponse(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
