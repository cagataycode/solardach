import { mkdir, readFile, writeFile, access } from "fs/promises";
import { join } from "path";
import type { Utm32 } from "./projection";
import { tileNameFor } from "./projection";

const NRW_BASE_URL =
  "https://www.opengeodata.nrw.de/produkte/geobasis/3dg/lod2_gml/lod2_gml/";

const CACHE_DIR = join(process.cwd(), "data", "lod2-cache");

/**
 * Download (or read from disk cache) the 1 km² CityGML tile containing the
 * given UTM32 coordinate. Tiles are open data (dl-de/zero-2-0), ~0.5-5 MB.
 * Empty tiles ("Leerkacheln") exist as ~1.5 KB stub files.
 */
export async function getTileGml(utm: Utm32): Promise<string | null> {
  const name = tileNameFor(utm);
  const cachePath = join(CACHE_DIR, `${name}.gml`);

  try {
    await access(cachePath);
    return await readFile(cachePath, "utf-8");
  } catch {
    // not cached yet
  }

  const res = await fetch(`${NRW_BASE_URL}${name}.gml`, {
    headers: { "User-Agent": "solar-dach-mvp/0.1" },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) return null;

  const gml = await res.text();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cachePath, gml, "utf-8");
  return gml;
}
