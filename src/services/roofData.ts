import { analyzeLod2 } from "./lod2";

/**
 * Roof data layer with explicit fallback tiers:
 *
 *   Tier 0  LOD2            German LoD2 open data — real roof geometry,
 *                           per-plane tilt/orientation and panel layout
 *   Tier 1  SOLAR_API       Google Solar API building insights (if key set)
 *   Tier 2  OSM_FOOTPRINT   OSM building footprint via Overpass, heuristic
 *   Tier 3  REGION_DEFAULT  conservative single-family-home default
 *
 * Each tier degrades confidence; the tier is stored and surfaced to the user.
 */
export type RoofDataTier =
  | "LOD2"
  | "SOLAR_API"
  | "OSM_FOOTPRINT"
  | "REGION_DEFAULT";

export interface RoofData {
  tier: RoofDataTier;
  roofAreaM2: number | null;
  usableRoofAreaM2: number;
  orientation: string; // S | SW | SE | E | W | FLAT | UNKNOWN
  shadingFactor: number; // 0..1, 1 = no shading
  /** Only set by the LOD2 tier: capacity from an actual panel layout. */
  panelCapacityKw?: number;
  panelCount?: number;
  tiltDeg?: number | null;
}

/** Conservative default for a German single-family home. */
const REGION_DEFAULT: RoofData = {
  tier: "REGION_DEFAULT",
  roofAreaM2: null,
  usableRoofAreaM2: 35,
  orientation: "UNKNOWN",
  shadingFactor: 0.9,
};

export async function getRoofData(
  latitude: number,
  longitude: number
): Promise<RoofData> {
  const fromLod2 = await analyzeLod2(latitude, longitude).catch(() => null);
  if (fromLod2 && fromLod2.panelCount > 0) {
    return {
      tier: "LOD2",
      roofAreaM2: fromLod2.scene.roofs.reduce((s, r) => s + r.areaM2, 0),
      usableRoofAreaM2: fromLod2.usableRoofAreaM2,
      orientation: fromLod2.bestOrientation,
      shadingFactor: 0.95,
      panelCapacityKw: fromLod2.panelCapacityKw,
      panelCount: fromLod2.panelCount,
      tiltDeg: fromLod2.bestTiltDeg,
    };
  }

  if (process.env.GOOGLE_SOLAR_API_KEY) {
    const fromApi = await fromGoogleSolarApi(latitude, longitude);
    if (fromApi) return fromApi;
  }
  const fromOsm = await fromOsmFootprint(latitude, longitude);
  if (fromOsm) return fromOsm;
  return REGION_DEFAULT;
}

// --- Tier 1: Google Solar API -------------------------------------------

async function fromGoogleSolarApi(
  latitude: number,
  longitude: number
): Promise<RoofData | null> {
  const url = new URL("https://solar.googleapis.com/v1/buildingInsights:findClosest");
  url.searchParams.set("location.latitude", latitude.toFixed(6));
  url.searchParams.set("location.longitude", longitude.toFixed(6));
  url.searchParams.set("requiredQuality", "MEDIUM");
  url.searchParams.set("key", process.env.GOOGLE_SOLAR_API_KEY!);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      solarPotential?: {
        maxArrayAreaMeters2?: number;
        wholeRoofStats?: { areaMeters2?: number };
        maxSunshineHoursPerYear?: number;
        roofSegmentStats?: Array<{ azimuthDegrees?: number; stats?: { areaMeters2?: number } }>;
      };
    };
    const sp = data.solarPotential;
    if (!sp?.maxArrayAreaMeters2) return null;

    return {
      tier: "SOLAR_API",
      roofAreaM2: sp.wholeRoofStats?.areaMeters2 ?? null,
      usableRoofAreaM2: sp.maxArrayAreaMeters2,
      orientation: dominantOrientation(sp.roofSegmentStats ?? []),
      // Solar API already accounts for shading in usable area; keep factor high
      shadingFactor: 0.95,
    };
  } catch {
    return null;
  }
}

function dominantOrientation(
  segments: Array<{ azimuthDegrees?: number; stats?: { areaMeters2?: number } }>
): string {
  let best: { azimuth: number; area: number } | null = null;
  for (const s of segments) {
    const area = s.stats?.areaMeters2 ?? 0;
    if (s.azimuthDegrees !== undefined && (!best || area > best.area)) {
      best = { azimuth: s.azimuthDegrees, area };
    }
  }
  if (!best) return "UNKNOWN";
  const a = best.azimuth;
  if (a >= 135 && a < 225) return "S";
  if (a >= 90 && a < 135) return "SE";
  if (a >= 225 && a < 270) return "SW";
  if (a >= 45 && a < 90) return "E";
  if (a >= 270 && a < 315) return "W";
  return "UNKNOWN";
}

// --- Tier 2: OSM building footprint via Overpass --------------------------

async function fromOsmFootprint(
  latitude: number,
  longitude: number
): Promise<RoofData | null> {
  // Find the building polygon containing (or nearest to) the point.
  // Note: Overpass requires a form-encoded `data=` body and rejects Node's
  // default User-Agent at the Apache level (406).
  const query = `[out:json][timeout:8];(way["building"](around:30,${latitude.toFixed(6)},${longitude.toFixed(6)}););out geom 1;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: "data=" + encodeURIComponent(query),
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "solar-dach-mvp/0.1",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      elements: Array<{ geometry?: Array<{ lat: number; lon: number }> }>;
    };
    const geom = data.elements?.[0]?.geometry;
    if (!geom || geom.length < 4) return null;

    const footprintM2 = polygonAreaM2(geom);
    if (footprintM2 < 20 || footprintM2 > 600) return null; // not a plausible single-family home

    // Heuristic: pitched roof ≈ footprint / cos(35°); ~40% of roof is usable
    // (one favorable side, minus windows/chimneys/setbacks). Conservative.
    const roofAreaM2 = footprintM2 / Math.cos((35 * Math.PI) / 180);
    return {
      tier: "OSM_FOOTPRINT",
      roofAreaM2: round1(roofAreaM2),
      usableRoofAreaM2: round1(roofAreaM2 * 0.4),
      orientation: "UNKNOWN",
      shadingFactor: 0.85,
    };
  } catch {
    return null;
  }
}

/** Shoelace formula on an equirectangular projection — fine at house scale. */
function polygonAreaM2(points: Array<{ lat: number; lon: number }>): number {
  const R = 6371000;
  const lat0 = (points[0].lat * Math.PI) / 180;
  const xy = points.map((p) => ({
    x: ((p.lon * Math.PI) / 180) * R * Math.cos(lat0),
    y: ((p.lat * Math.PI) / 180) * R,
  }));
  let area = 0;
  for (let i = 0; i < xy.length - 1; i++) {
    area += xy[i].x * xy[i + 1].y - xy[i + 1].x * xy[i].y;
  }
  return Math.abs(area / 2);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
