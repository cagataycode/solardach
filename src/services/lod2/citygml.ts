import type { Vec3 } from "./geometry";
import { pointInRing2D } from "./geometry";

/**
 * Lightweight CityGML (LoD2, NRW flavor) extraction. Tiles are large
 * (up to ~40 MB), so instead of a full XML parse we scan for building
 * chunks and extract surface rings with targeted regexes — the NRW files
 * are machine-generated with a fixed structure, which makes this safe.
 */

export type SurfaceKind = "roof" | "wall" | "ground";

export interface BuildingSurface {
  kind: SurfaceKind;
  /** Exterior ring, EPSG:25832 + height, closing vertex removed. */
  ring: Vec3[];
}

export interface ParsedBuilding {
  id: string;
  roofTypeCode: string | null;
  surfaces: BuildingSurface[];
}

const BUILDING_OPEN = "<bldg:Building gml:id=";
const BUILDING_CLOSE = "</bldg:Building>";

const SURFACE_PATTERNS: Array<{ kind: SurfaceKind; open: string; close: string }> = [
  { kind: "roof", open: "<bldg:RoofSurface", close: "</bldg:RoofSurface>" },
  { kind: "wall", open: "<bldg:WallSurface", close: "</bldg:WallSurface>" },
  { kind: "ground", open: "<bldg:GroundSurface", close: "</bldg:GroundSurface>" },
];

const POSLIST_RE = /<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/g;

function* buildingChunks(gml: string): Generator<string> {
  let from = 0;
  for (;;) {
    const start = gml.indexOf(BUILDING_OPEN, from);
    if (start === -1) return;
    const end = gml.indexOf(BUILDING_CLOSE, start);
    if (end === -1) return;
    yield gml.slice(start, end + BUILDING_CLOSE.length);
    from = end + BUILDING_CLOSE.length;
  }
}

function parsePosList(text: string): Vec3[] {
  const nums = text.trim().split(/\s+/).map(Number);
  const ring: Vec3[] = [];
  for (let i = 0; i + 2 < nums.length; i += 3) {
    ring.push([nums[i], nums[i + 1], nums[i + 2]]);
  }
  // Drop the closing vertex (GML rings repeat the first point at the end).
  if (ring.length > 1) {
    const [f, l] = [ring[0], ring[ring.length - 1]];
    if (f[0] === l[0] && f[1] === l[1] && f[2] === l[2]) ring.pop();
  }
  return ring;
}

function parseBuilding(chunk: string): ParsedBuilding {
  const id = chunk.match(/gml:id="([^"]+)"/)?.[1] ?? "unknown";
  const roofTypeCode = chunk.match(/<bldg:roofType>(\d+)<\/bldg:roofType>/)?.[1] ?? null;
  const surfaces: BuildingSurface[] = [];

  for (const { kind, open, close } of SURFACE_PATTERNS) {
    let from = 0;
    for (;;) {
      const start = chunk.indexOf(open, from);
      if (start === -1) break;
      const end = chunk.indexOf(close, start);
      if (end === -1) break;
      const surfaceXml = chunk.slice(start, end);
      for (const m of surfaceXml.matchAll(POSLIST_RE)) {
        const ring = parsePosList(m[1]);
        if (ring.length >= 3) surfaces.push({ kind, ring });
      }
      from = end + close.length;
    }
  }
  return { id, roofTypeCode, surfaces };
}

function footprintContains(b: ParsedBuilding, e: number, n: number): boolean {
  return b.surfaces.some(
    (s) => s.kind === "ground" && pointInRing2D(e, n, s.ring)
  );
}

function centroidDistance(b: ParsedBuilding, e: number, n: number): number {
  const grounds = b.surfaces.filter((s) => s.kind === "ground");
  if (grounds.length === 0) return Infinity;
  let cx = 0,
    cy = 0,
    count = 0;
  for (const g of grounds)
    for (const p of g.ring) {
      cx += p[0];
      cy += p[1];
      count++;
    }
  return Math.hypot(cx / count - e, cy / count - n);
}

export interface BuildingLookup {
  building: ParsedBuilding;
  /** Other buildings whose footprint centroid is within `radius` m. */
  neighbors: ParsedBuilding[];
}

/**
 * Find the building at (easting, northing): footprint containment first,
 * nearest-within-25m as fallback (geocoders often return street positions).
 */
export function findBuilding(
  gml: string,
  easting: number,
  northing: number,
  neighborRadiusM = 60
): BuildingLookup | null {
  const all: ParsedBuilding[] = [];
  for (const chunk of buildingChunks(gml)) {
    // Cheap bbox pre-filter on the raw text before full ring parsing.
    all.push(parseBuilding(chunk));
  }

  let target =
    all.find((b) => footprintContains(b, easting, northing)) ?? null;
  if (!target) {
    let best: { b: ParsedBuilding; d: number } | null = null;
    for (const b of all) {
      const d = centroidDistance(b, easting, northing);
      if (d < 25 && (!best || d < best.d)) best = { b, d };
    }
    target = best?.b ?? null;
  }
  if (!target) return null;

  const neighbors = all.filter(
    (b) =>
      b.id !== target!.id &&
      centroidDistance(b, easting, northing) < neighborRadiusM
  );
  return { building: target, neighbors };
}
