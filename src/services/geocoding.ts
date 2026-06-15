/**
 * Address resolution for German addresses via Photon (komoot) — free,
 * OSM-based, no API key. Swap for a commercial geocoder before scaling.
 */
export interface ResolvedAddress {
  street?: string;
  houseNumber?: string;
  postcode?: string;
  city?: string;
  state?: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    countrycode?: string;
    name?: string;
    osm_value?: string;
  };
}

export async function geocodeGermanAddress(
  rawInput: string
): Promise<ResolvedAddress | null> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", rawInput);
  url.searchParams.set("lang", "de");
  url.searchParams.set("limit", "1");
  // Bias towards Germany's centroid for the pilot
  url.searchParams.set("lat", "51.16");
  url.searchParams.set("lon", "10.45");

  const res = await fetch(url, {
    headers: { "User-Agent": "solar-dach-mvp/0.1" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status}`);

  const data = (await res.json()) as { features: PhotonFeature[] };
  const feature = data.features?.[0];
  if (!feature) return null;

  const p = feature.properties;
  if (p.countrycode && p.countrycode.toUpperCase() !== "DE") return null;

  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    street: p.street ?? (p.osm_value === "house" ? p.name : undefined),
    houseNumber: p.housenumber,
    postcode: p.postcode,
    city: p.city,
    state: p.state,
    countryCode: "DE",
    latitude,
    longitude,
    displayName: [
      [p.street ?? p.name, p.housenumber].filter(Boolean).join(" "),
      [p.postcode, p.city].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(", "),
  };
}
