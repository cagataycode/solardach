import { analyzeLod2 } from "../src/services/lod2";

const lat = Number(process.argv[2] ?? 50.9692688);
const lon = Number(process.argv[3] ?? 6.8339064);

async function main() {
  const t0 = Date.now();
  const a = await analyzeLod2(lat, lon);
  console.log("elapsed:", Date.now() - t0, "ms");
  if (!a) {
    console.log("NO RESULT");
    process.exit(1);
  }
  console.log("building:", a.buildingId);
  console.log(
    "usable roof:",
    a.usableRoofAreaM2,
    "m2 | best:",
    a.bestOrientation,
    a.bestTiltDeg,
    "deg"
  );
  console.log("panels:", a.panelCount, "->", a.panelCapacityKw, "kWp");
  console.log("roof planes:");
  for (const r of a.scene.roofs)
    console.log(
      "  ",
      r.compass,
      "tilt",
      r.tiltDeg,
      "area",
      r.areaM2,
      "panels",
      r.panelCount
    );
  console.log(
    "walls:",
    a.scene.walls.length,
    "| neighbor surfaces:",
    a.scene.neighborSurfaces.length
  );
}

main();
