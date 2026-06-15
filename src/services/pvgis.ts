/**
 * Regional irradiance via PVGIS (EU Joint Research Centre) — free, no key.
 * Returns the specific yield (kWh per kWp per year) for a 1 kWp reference
 * system at the given coordinates. Typical German values: ~950-1100.
 */
const PVGIS_BASE = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc";

/** Conservative fallback if PVGIS is unreachable (low end for Germany). */
export const GERMANY_DEFAULT_SPECIFIC_YIELD = 950;

export async function getSpecificYield(
  latitude: number,
  longitude: number
): Promise<{ specificYieldKwhPerKwp: number; source: "pvgis" | "default" }> {
  const url = new URL(PVGIS_BASE);
  url.searchParams.set("lat", latitude.toFixed(5));
  url.searchParams.set("lon", longitude.toFixed(5));
  url.searchParams.set("peakpower", "1");
  url.searchParams.set("loss", "14");
  url.searchParams.set("mountingplace", "building");
  url.searchParams.set("angle", "35");
  url.searchParams.set("aspect", "0"); // south-facing reference
  url.searchParams.set("outputformat", "json");

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`PVGIS ${res.status}`);
    const data = (await res.json()) as {
      outputs?: { totals?: { fixed?: { E_y?: number } } };
    };
    const yearly = data.outputs?.totals?.fixed?.E_y;
    if (typeof yearly === "number" && yearly > 0) {
      return { specificYieldKwhPerKwp: yearly, source: "pvgis" };
    }
  } catch {
    // fall through to default
  }
  return {
    specificYieldKwhPerKwp: GERMANY_DEFAULT_SPECIFIC_YIELD,
    source: "default",
  };
}
