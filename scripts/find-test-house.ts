/** Dev helper: scan a cached tile for classic pitched-roof family homes. */
import { readFile } from "fs/promises";
import { findBuilding } from "../src/services/lod2/citygml";
import { ringArea3D, tiltAndAzimuth } from "../src/services/lod2/geometry";
import { utm32ToWgs84 } from "../src/services/lod2/projection";

async function main() {
  const gml = await readFile(
    "data/lod2-cache/LoD2_32_347_5648_1_NW.gml",
    "utf-8"
  );
  // Reuse the chunk scanner indirectly: brute-force grid probe across the tile.
  const found: string[] = [];
  for (let e = 347050; e < 348000 && found.length < 8; e += 90) {
    for (let n = 5648050; n < 5649000 && found.length < 8; n += 90) {
      const hit = findBuilding(gml, e, n, 0);
      if (!hit) continue;
      const roofs = hit.building.surfaces.filter((s) => s.kind === "roof");
      const pitched = roofs.filter((r) => {
        const { tiltDeg } = tiltAndAzimuth(r.ring);
        return tiltDeg > 25 && tiltDeg < 55 && ringArea3D(r.ring) > 25;
      });
      if (pitched.length >= 2 && roofs.length <= 4) {
        const g = hit.building.surfaces.find((s) => s.kind === "ground");
        if (!g) continue;
        const cx = g.ring.reduce((s, p) => s + p[0], 0) / g.ring.length;
        const cy = g.ring.reduce((s, p) => s + p[1], 0) / g.ring.length;
        const { latitude, longitude } = utm32ToWgs84(cx, cy);
        const line = `${hit.building.id} lat=${latitude.toFixed(6)} lon=${longitude.toFixed(6)} planes=${roofs.length}`;
        if (!found.includes(line)) found.push(line);
      }
    }
  }
  console.log(found.join("\n") || "none found");
}

main();
