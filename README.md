# solar-dach

B2C solar lead-generation MVP for the German market. Homeowners enter their
own address, get an instant solar suitability score and a conservative savings
range, and convert via a GDPR-compliant lead form. Qualified leads are sold to
partner installers (Solarteure).

See `high-level-plan.md` for the full product blueprint and compliance model.

## Stack

- **Next.js 16** (App Router, TypeScript) — frontend + API routes
- **Prisma 6 + SQLite** (dev) — switch to Postgres (EU region) for production
- **Tailwind CSS 4**
- **Zod** for input validation

## Data sources (all free / public)

| Tier | Source | Used for | Confidence |
|------|--------|----------|------------|
| 0 | **NRW LoD2 3D building models** (open data, dl-de/zero-2-0) | real roof geometry: per-plane tilt/orientation/area, actual panel layout, interactive 3D viewer | 90 % |
| 1 | Google Solar API (optional, needs key) | usable roof area, orientation | 85 % |
| 2 | OSM building footprint (Overpass) | roof area heuristic | 55 % |
| 3 | Region default (DE single-family home) | conservative fallback | 30 % |
| — | PVGIS (EU JRC) | regional specific yield (kWh/kWp) | — |
| — | Photon (komoot) | German address geocoding | — |

Every result stores and surfaces which tier answered, so estimates are
explainable and honestly labeled.

## 3D visualization (the differentiator)

When LoD2 data is available (`src/services/lod2/`), the result page shows the
homeowner's actual house in an interactive Three.js scene: real roof planes
from official survey data, a computed panel layout, neighboring buildings,
and a sun-position slider (SunCalc) with real-time shadows.

For a photorealistic, personal feel, the official NRW aerial orthophoto
(DOP, 10 cm, also open data) is draped over the ground plane and all roof
surfaces via `/api/orthophoto` (server-side WMS proxy, disk-cached in
`data/dop-cache/`). The user sees their real roof tiles, garden and street
in 3D — no Google dependency, no per-query cost.

Pipeline: address → EPSG:25832 → 1 km² CityGML tile (downloaded once, cached
in `data/lod2-cache/`) → building lookup by footprint → roof plane extraction
(tilt/azimuth/area via Newell normals) → panel grid fitted per favorable
plane → local ENU scene JSON (~50-100 KB) → client-side rendering.

Dev helpers: `npx tsx scripts/test-lod2.ts [lat] [lon]` tests the pipeline,
`npx tsx scripts/screenshot.ts "<address>"` screenshots the funnel.

Currently NRW only. Other states publish compatible LoD2 CityGML open data
(Bayern, BW, Hessen, …) — adding a state means adding its tile URL scheme in
`src/services/lod2/tiles.ts`.

## Getting started

```bash
npm install
cp .env.example .env
npx prisma db push
npm run dev
```

Open http://localhost:3000.

## Flow

1. `POST /api/check` — address → geocode → roof data (tiered fallback) →
   PVGIS yield → score + savings estimate. Stored as `PropertyCheck` +
   `SolarEstimate`. No personal data yet.
2. `POST /api/leads` — lead form with two **mandatory, separate consents**
   (contact + lead sharing), logged verbatim in `ConsentLog` with IP/UA.
   Lead starts as `DOUBLE_OPT_IN_PENDING`.
3. `GET /api/leads/confirm?token=…` — double opt-in confirmation
   (link is currently logged to the server console; wire up an EU-hosted ESP
   like Brevo before launch).
4. Lead handoff to installers via `InstallerPartner` / `LeadAssignment`
   (schema ready; admin UI is the next build step).

## Economics assumptions

All German market assumptions (electricity price, EEG Einspeisevergütung,
self-consumption share, system cost per kWp) are configured via env vars —
see `.env.example`. Review quarterly; the feed-in tariff is subject to
degression.

## Before public launch (compliance checklist)

- [ ] Fill in `Impressum` with real company data (§ 5 DDG)
- [ ] Complete `Datenschutzerklärung` (have it reviewed professionally)
- [ ] Wire double opt-in emails to an EU-hosted ESP
- [ ] Sign AVV (data processing agreements) with every installer partner
      before any lead handoff (`avvSignedAt` field enforces tracking)
- [ ] Cookie consent banner if any analytics/tracking is added (TDDDG)
- [ ] Data retention / deletion job for stale leads
- [ ] Switch SQLite → Postgres in an EU region
- [ ] Replace Photon/public Overpass with paid tiers or self-hosted
      instances before real traffic (public instances are rate-limited)
# solardach
