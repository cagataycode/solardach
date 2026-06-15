import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analyzeLod2 } from "@/services/lod2";

/**
 * 3D scene payload for a previous property check. Recomputed from cached
 * LoD2 tiles (fast after first hit); nothing personal is stored or returned.
 */
export async function GET(req: Request) {
  const checkId = new URL(req.url).searchParams.get("checkId");
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
    return NextResponse.json(
      { error: "Für dieses Gebäude liegen keine 3D-Daten vor." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    buildingId: analysis.buildingId,
    panelCount: analysis.panelCount,
    panelCapacityKw: analysis.panelCapacityKw,
    scene: analysis.scene,
  });
}
