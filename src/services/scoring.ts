import type { RoofData } from "./roofData";

/**
 * Explainable V1 suitability scoring. Heuristic and transparent by design:
 * every factor is visible, weighted, and degrades gracefully with data tier.
 */
export interface ScoringResult {
  solarFitScore: number; // 0..100
  estimatedCapacityKw: number;
  confidenceScore: number; // 0..100
  factors: Record<string, number>; // each 0..1, for explainability
}

/** kWp that fits per m² of usable roof (modern ~430 Wp modules incl. spacing). */
const KWP_PER_M2 = 0.2;

export function scoreProperty(
  roof: RoofData,
  specificYieldKwhPerKwp: number
): ScoringResult {
  // Factor: usable area (saturates at 50 m² ≈ 10 kWp)
  const areaFactor = clamp01(roof.usableRoofAreaM2 / 50);

  // Factor: orientation
  const orientationFactor =
    { S: 1.0, SE: 0.92, SW: 0.92, E: 0.78, W: 0.78, FLAT: 0.88, UNKNOWN: 0.82 }[
      roof.orientation
    ] ?? 0.82;

  // Factor: shading
  const shadingFactor = roof.shadingFactor;

  // Factor: regional irradiance (normalize German range ~900-1150 kWh/kWp)
  const irradianceFactor = clamp01((specificYieldKwhPerKwp - 850) / 300);

  const factors = {
    area: round2(areaFactor),
    orientation: round2(orientationFactor),
    shading: round2(shadingFactor),
    irradiance: round2(irradianceFactor),
  };

  const solarFitScore = Math.round(
    100 *
      (0.4 * areaFactor +
        0.25 * orientationFactor +
        0.2 * shadingFactor +
        0.15 * irradianceFactor)
  );

  // LOD2 gives capacity from an actual panel layout; otherwise approximate
  // from usable area. Capped at 25 kWp to stay in residential territory.
  const rawCapacityKw =
    roof.panelCapacityKw ?? roof.usableRoofAreaM2 * KWP_PER_M2;
  const estimatedCapacityKw = Math.min(Math.round(rawCapacityKw * 10) / 10, 25);

  const confidenceScore = {
    LOD2: 90,
    SOLAR_API: 85,
    OSM_FOOTPRINT: 55,
    REGION_DEFAULT: 30,
  }[roof.tier];

  return { solarFitScore, estimatedCapacityKw, confidenceScore, factors };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
