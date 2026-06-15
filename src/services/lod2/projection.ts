import proj4 from "proj4";

/**
 * NRW LoD2 data is delivered in EPSG:25832 (ETRS89 / UTM zone 32N),
 * packaged as 1 km × 1 km tiles named by the km grid of the SW corner:
 *   LoD2_32_<easting_km>_<northing_km>_1_NW.gml
 */
proj4.defs(
  "EPSG:25832",
  "+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
);

export interface Utm32 {
  easting: number;
  northing: number;
}

export function wgs84ToUtm32(latitude: number, longitude: number): Utm32 {
  const [easting, northing] = proj4("EPSG:4326", "EPSG:25832", [
    longitude,
    latitude,
  ]);
  return { easting, northing };
}

export function utm32ToWgs84(easting: number, northing: number): {
  latitude: number;
  longitude: number;
} {
  const [longitude, latitude] = proj4("EPSG:25832", "EPSG:4326", [
    easting,
    northing,
  ]);
  return { latitude, longitude };
}

export function tileNameFor(utm: Utm32): string {
  const e = Math.floor(utm.easting / 1000);
  const n = Math.floor(utm.northing / 1000);
  return `LoD2_32_${e}_${n}_1_NW`;
}
