import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { pilotPostcodePrefixes } from "@/lib/config";
import { geocodeGermanAddress } from "@/services/geocoding";
import { getSpecificYield } from "@/services/pvgis";
import { getRoofData } from "@/services/roofData";
import { scoreProperty } from "@/services/scoring";
import { estimateSavings } from "@/services/estimator";

const checkSchema = z.object({
  address: z.string().min(5).max(200),
  consumptionBandKwh: z
    .number()
    .int()
    .refine((v) => [2500, 3500, 4500, 6000].includes(v))
    .default(3500),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bitte geben Sie eine gültige Adresse ein." },
      { status: 400 }
    );
  }
  const { address, consumptionBandKwh } = parsed.data;

  const resolved = await geocodeGermanAddress(address).catch(() => null);
  if (!resolved) {
    return NextResponse.json(
      { error: "Adresse nicht gefunden. Bitte prüfen Sie Ihre Eingabe (nur Deutschland)." },
      { status: 404 }
    );
  }

  const prefixes = pilotPostcodePrefixes();
  if (
    prefixes.length > 0 &&
    !prefixes.some((p) => resolved.postcode?.startsWith(p))
  ) {
    return NextResponse.json(
      { error: "Diese Region ist noch nicht Teil unserer Pilotphase." },
      { status: 422 }
    );
  }

  const [roof, irradiance] = await Promise.all([
    getRoofData(resolved.latitude, resolved.longitude),
    getSpecificYield(resolved.latitude, resolved.longitude),
  ]);

  const score = scoreProperty(roof, irradiance.specificYieldKwhPerKwp);
  const estimate = estimateSavings({
    estimatedCapacityKw: score.estimatedCapacityKw,
    specificYieldKwhPerKwp: irradiance.specificYieldKwhPerKwp,
    consumptionBandKwh,
  });

  const check = await db.propertyCheck.create({
    data: {
      rawInput: address,
      street: resolved.street,
      houseNumber: resolved.houseNumber,
      postcode: resolved.postcode,
      city: resolved.city,
      state: resolved.state,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      roofDataTier: roof.tier,
      roofAreaM2: roof.roofAreaM2,
      usableRoofAreaM2: roof.usableRoofAreaM2,
      roofOrientation: roof.orientation,
      shadingFactor: roof.shadingFactor,
      specificYieldKwhPerKwp: irradiance.specificYieldKwhPerKwp,
      solarFitScore: score.solarFitScore,
      estimatedCapacityKw: score.estimatedCapacityKw,
      confidenceScore: score.confidenceScore,
      estimate: {
        create: {
          consumptionBandKwh,
          electricityPriceCtKwh: estimate.assumptions.electricityPriceCtKwh,
          feedInTariffCtKwh: estimate.assumptions.feedInTariffCtKwh,
          selfConsumptionShare: estimate.assumptions.selfConsumptionShare,
          systemCostPerKwpEurLow: estimate.assumptions.systemCostPerKwpEurLow,
          systemCostPerKwpEurHigh: estimate.assumptions.systemCostPerKwpEurHigh,
          annualProductionKwhLow: estimate.annualProductionKwhLow,
          annualProductionKwhHigh: estimate.annualProductionKwhHigh,
          annualSavingsEurLow: estimate.annualSavingsEurLow,
          annualSavingsEurHigh: estimate.annualSavingsEurHigh,
          paybackYearsLow: estimate.paybackYearsLow,
          paybackYearsHigh: estimate.paybackYearsHigh,
        },
      },
    },
  });

  return NextResponse.json({
    checkId: check.id,
    address: resolved.displayName,
    roofDataTier: roof.tier,
    usableRoofAreaM2: roof.usableRoofAreaM2,
    orientation: roof.orientation,
    panelCount: roof.panelCount ?? null,
    solarFitScore: score.solarFitScore,
    estimatedCapacityKw: score.estimatedCapacityKw,
    confidenceScore: score.confidenceScore,
    factors: score.factors,
    estimate: {
      annualProductionKwhLow: estimate.annualProductionKwhLow,
      annualProductionKwhHigh: estimate.annualProductionKwhHigh,
      annualSavingsEurLow: estimate.annualSavingsEurLow,
      annualSavingsEurHigh: estimate.annualSavingsEurHigh,
      paybackYearsLow: estimate.paybackYearsLow,
      paybackYearsHigh: estimate.paybackYearsHigh,
    },
  });
}
