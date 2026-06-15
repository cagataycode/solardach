/**
 * German economics assumptions. All configurable via env — these numbers
 * change over time (EEG degression, electricity prices) and must never be
 * hardcoded deeper in the codebase.
 */
function num(envVar: string, fallback: number): number {
  const v = process.env[envVar];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const assumptions = {
  electricityPriceCtKwh: () => num("ASSUMPTION_ELECTRICITY_PRICE_CT_KWH", 30),
  feedInTariffCtKwh: () => num("ASSUMPTION_FEED_IN_TARIFF_CT_KWH", 7.9),
  selfConsumptionShare: () => num("ASSUMPTION_SELF_CONSUMPTION_SHARE", 0.3),
  systemCostPerKwpEurLow: () => num("ASSUMPTION_SYSTEM_COST_PER_KWP_EUR_LOW", 1300),
  systemCostPerKwpEurHigh: () => num("ASSUMPTION_SYSTEM_COST_PER_KWP_EUR_HIGH", 1800),
};

export function pilotPostcodePrefixes(): string[] {
  return (process.env.PILOT_POSTCODE_PREFIXES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
