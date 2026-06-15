import { assumptions } from "@/lib/config";

/**
 * Conservative German savings model. All outputs are ranges and must be
 * presented as "unverbindliche Schätzung" — never as guarantees.
 *
 * Model:
 *   production            = capacity × specific yield (±10%)
 *   self-consumed energy  = min(production × selfShare, consumption)
 *   savings               = selfConsumed × electricityPrice
 *                         + (production − selfConsumed) × feedInTariff
 *   payback               = system cost range / annual savings range
 */
export interface EstimateInput {
  estimatedCapacityKw: number;
  specificYieldKwhPerKwp: number;
  consumptionBandKwh: number; // e.g. 2500 / 3500 / 4500 / 6000
}

export interface EstimateResult {
  assumptions: {
    consumptionBandKwh: number;
    electricityPriceCtKwh: number;
    feedInTariffCtKwh: number;
    selfConsumptionShare: number;
    systemCostPerKwpEurLow: number;
    systemCostPerKwpEurHigh: number;
  };
  annualProductionKwhLow: number;
  annualProductionKwhHigh: number;
  annualSavingsEurLow: number;
  annualSavingsEurHigh: number;
  paybackYearsLow: number;
  paybackYearsHigh: number;
}

export function estimateSavings(input: EstimateInput): EstimateResult {
  const a = {
    consumptionBandKwh: input.consumptionBandKwh,
    electricityPriceCtKwh: assumptions.electricityPriceCtKwh(),
    feedInTariffCtKwh: assumptions.feedInTariffCtKwh(),
    selfConsumptionShare: assumptions.selfConsumptionShare(),
    systemCostPerKwpEurLow: assumptions.systemCostPerKwpEurLow(),
    systemCostPerKwpEurHigh: assumptions.systemCostPerKwpEurHigh(),
  };

  const production =
    input.estimatedCapacityKw * input.specificYieldKwhPerKwp;
  const productionLow = production * 0.9;
  const productionHigh = production * 1.1;

  const savingsFor = (prod: number): number => {
    const selfConsumed = Math.min(
      prod * a.selfConsumptionShare,
      input.consumptionBandKwh
    );
    const exported = Math.max(prod - selfConsumed, 0);
    return (
      (selfConsumed * a.electricityPriceCtKwh + exported * a.feedInTariffCtKwh) /
      100
    );
  };

  const savingsLow = savingsFor(productionLow);
  const savingsHigh = savingsFor(productionHigh);

  const costLow = input.estimatedCapacityKw * a.systemCostPerKwpEurLow;
  const costHigh = input.estimatedCapacityKw * a.systemCostPerKwpEurHigh;

  return {
    assumptions: a,
    annualProductionKwhLow: Math.round(productionLow),
    annualProductionKwhHigh: Math.round(productionHigh),
    annualSavingsEurLow: Math.round(savingsLow),
    annualSavingsEurHigh: Math.round(savingsHigh),
    paybackYearsLow: round1(costLow / savingsHigh),
    paybackYearsHigh: round1(costHigh / savingsLow),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
