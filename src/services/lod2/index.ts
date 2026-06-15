import { wgs84ToUtm32 } from "./projection";
import { getTileGml } from "./tiles";
import { findBuilding, type ParsedBuilding } from "./citygml";
import { layoutPanels, PANEL } from "./panels";
import {
  azimuthToCompass,
  ringArea3D,
  tiltAndAzimuth,
  type Vec3,
} from "./geometry";

/**
 * Full LoD2 analysis for one address: real roof geometry from NRW open data
 * (dl-de/zero-2-0), panel layout per roof plane, and a 3D scene payload in
 * local ENU coordinates (meters, origin at footprint centroid / ground level)
 * ready for client-side rendering.
 */

export interface RoofPlane {
  ring: Vec3[]; // local ENU
  tiltDeg: number;
  azimuthDeg: number | null;
  compass: string;
  areaM2: number;
  panelCount: number;
}

export interface Lod2Scene {
  originLatitude: number;
  originLongitude: number;
  roofs: RoofPlane[];
  walls: Vec3[][];
  panels: Array<[Vec3, Vec3, Vec3, Vec3]>;
  neighborSurfaces: Array<{ kind: string; ring: Vec3[] }>;
}

export interface Lod2Analysis {
  buildingId: string;
  usableRoofAreaM2: number;
  bestOrientation: string;
  bestTiltDeg: number | null;
  panelCount: number;
  panelCapacityKw: number;
  /** Scene origin in EPSG:25832 — anchor for orthophoto bbox alignment. */
  originUtm: { easting: number; northing: number };
  scene: Lod2Scene;
}

const MIN_PLANE_AREA_M2 = 4;

export async function analyzeLod2(
  latitude: number,
  longitude: number
): Promise<Lod2Analysis | null> {
  const utm = wgs84ToUtm32(latitude, longitude);
  const gml = await getTileGml(utm).catch(() => null);
  if (!gml || gml.length < 5000) return null; // missing or empty tile

  const lookup = findBuilding(gml, utm.easting, utm.northing);
  if (!lookup) return null;
  const { building, neighbors } = lookup;

  // Local origin: footprint centroid at ground level.
  const groundPoints = building.surfaces
    .filter((s) => s.kind === "ground")
    .flatMap((s) => s.ring);
  if (groundPoints.length === 0) return null;
  const cx = avg(groundPoints.map((p) => p[0]));
  const cy = avg(groundPoints.map((p) => p[1]));
  const groundZ = Math.min(...groundPoints.map((p) => p[2]));
  const toLocal = (p: Vec3): Vec3 => [p[0] - cx, p[1] - cy, p[2] - groundZ];

  const roofs: RoofPlane[] = [];
  const panels: Array<[Vec3, Vec3, Vec3, Vec3]> = [];

  for (const s of building.surfaces) {
    if (s.kind !== "roof") continue;
    const { tiltDeg, azimuthDeg } = tiltAndAzimuth(s.ring);
    const areaM2 = ringArea3D(s.ring);
    const planePanels =
      areaM2 >= MIN_PLANE_AREA_M2 && isFavorable(azimuthDeg, tiltDeg)
        ? layoutPanels(s.ring)
        : [];

    roofs.push({
      ring: s.ring.map(toLocal),
      tiltDeg: round1(tiltDeg),
      azimuthDeg: azimuthDeg === null ? null : round1(azimuthDeg),
      compass: azimuthToCompass(azimuthDeg),
      areaM2: round1(areaM2),
      panelCount: planePanels.length,
    });
    for (const p of planePanels) {
      panels.push([
        toLocal(p.corners[0]),
        toLocal(p.corners[1]),
        toLocal(p.corners[2]),
        toLocal(p.corners[3]),
      ]);
    }
  }
  if (roofs.length === 0) return null;

  const bestPlane = roofs.reduce((a, b) =>
    b.panelCount > a.panelCount ? b : a
  );
  const usableRoofAreaM2 = roofs
    .filter((r) => r.panelCount > 0)
    .reduce((sum, r) => sum + r.areaM2, 0);

  return {
    buildingId: building.id,
    usableRoofAreaM2: round1(usableRoofAreaM2),
    bestOrientation: bestPlane.panelCount > 0 ? bestPlane.compass : "UNKNOWN",
    bestTiltDeg: bestPlane.panelCount > 0 ? bestPlane.tiltDeg : null,
    panelCount: panels.length,
    panelCapacityKw: round1(panels.length * PANEL.kwp),
    originUtm: { easting: cx, northing: cy },
    scene: {
      originLatitude: latitude,
      originLongitude: longitude,
      roofs,
      walls: building.surfaces
        .filter((s) => s.kind === "wall")
        .map((s) => s.ring.map(toLocal)),
      panels,
      neighborSurfaces: neighborSurfaces(neighbors, toLocal),
    },
  };
}

/**
 * North-facing steep roofs are excluded from panel layout; everything else
 * (S/E/W/flat) is fair game for an MVP estimate.
 */
function isFavorable(azimuthDeg: number | null, tiltDeg: number): boolean {
  if (tiltDeg > 75) return false;
  if (azimuthDeg === null) return true; // flat
  const isNorthish = azimuthDeg < 60 || azimuthDeg > 300;
  return !(isNorthish && tiltDeg > 20);
}

function neighborSurfaces(
  neighbors: ParsedBuilding[],
  toLocal: (p: Vec3) => Vec3
): Array<{ kind: string; ring: Vec3[] }> {
  const out: Array<{ kind: string; ring: Vec3[] }> = [];
  for (const n of neighbors) {
    for (const s of n.surfaces) {
      if (s.kind === "ground") continue;
      out.push({ kind: s.kind, ring: s.ring.map(toLocal) });
    }
  }
  return out;
}

function avg(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
