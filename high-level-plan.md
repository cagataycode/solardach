# Solar-DACH — High-Level Plan

> Revised for the DACH market (pilot: Germany). Business model: inbound lead generation,
> leads sold to local installation companies (Solarteure).
>
> **Strategy update (Jun 2026):** 3D visualization is now the core differentiator —
> implemented via German LoD2 open data (official 3D building models, dl-de/zero-2-0)
> instead of generated mockups or paid APIs. The homeowner sees their actual house in an
> interactive 3D scene with real roof geometry, a computed panel layout, and sun/shadow
> simulation. This replaces the earlier "generic visuals only" decision for V1: it shows
> *public survey data*, not a fabricated image, so the original compliance reasoning
> (no creepy generated mockups) still holds.

```text
You are a senior product engineer and startup CTO. Help me design and scaffold an MVP for a B2C solar lead-generation platform for the DACH market (pilot: Germany), inspired by the "instant address-based solar check" model proven by Otovo/Enpal/zolar.

Business model:
- We do NOT install panels. We generate and qualify homeowner leads and sell them to local installation companies (Solarteure).
- Revenue = per-lead sales and/or revenue share with installer partners.
- Pilot market: Germany only (one or two states with good open data, e.g. NRW or Baden-Württemberg). Austria and Switzerland are V2.

Important constraints:
- Fully inbound model: the homeowner enters their OWN address on our landing page. We do NOT proactively identify or contact specific homeowners. No scraping of personal data, no cold email, no cold calls (UWG §7), no unsolicited personalized mail.
- GDPR/DSGVO by design: property-level analysis only becomes personal data when the user submits the form. Lead resale to installers requires an explicit, separate, unticked consent checkbox naming the data sharing purpose. Double opt-in for any email follow-up.
- German-language UI. Legally required pages: Impressum, Datenschutzerklärung, cookie consent (TDDDG). EU-hosted infrastructure.
- This is a pre-qualification and marketing system, NOT an engineering design tool.
- All financial and production outputs must be conservative estimates/ranges, never guarantees, labeled "unverbindliche Schätzung".

My goal:
Build an MVP where a homeowner enters their address, instantly sees a solar suitability score, an estimated system size, and a rough savings range (with generic but high-quality visuals — NO house-specific roof mockups in V1), and converts via a lead form. Qualified leads are routed/sold to partner installers.

I want a practical startup-ready project skeleton with clear architecture, implementation plan, and code scaffolding.

Please give me the output in the following exact structure:

1. Product definition
- One paragraph summary of the product
- ICP on both sides: homeowner profile AND installer/lead-buyer profile
- Core value proposition for each side
- Main user journey (homeowner) and main partner journey (installer)

2. Compliance and risk guardrails (Germany-specific)
- GDPR/DSGVO obligations: lawful basis per processing step, consent design for lead resale, data retention, AVV (data processing agreements) with installers
- UWG §7 implications for any follow-up communication; double opt-in flow
- Required disclaimers for estimates ("unverbindliche Schätzung", no guarantee of feed-in tariff levels or prices)
- Impressum, Datenschutzerklärung, cookie consent requirements
- What we must NOT collect or infer (e.g. ownership status from registries, household income)

3. MVP scope
- V1 included: address input → instant suitability score + savings range → lead form → manual qualification → lead handoff to installers
- Explicitly out of scope: house-specific roof mockups, AT/CH markets, automated installer marketplace, battery/heat-pump/EV upsell calculators, outbound campaigns
- Fastest path to a 4-6 week pilot in one German state

4. System architecture
Design a modular architecture with these components:
- address resolution & geocoding (German addresses)
- roof/solar data layer (PVGIS irradiance; Google Solar API and/or state Solarkataster open data; OSM building footprints as fallback)
- suitability scoring engine
- savings estimator (German economics)
- landing page + instant-result experience + lead form
- lead qualification workflow (human review)
- installer/lead-buyer management & handoff (routing by region, lead acceptance tracking, simple pricing)
- analytics dashboard
- audit & consent logging

For each module, provide: purpose, inputs, outputs, recommended implementation approach, risks/failure modes (including data coverage gaps per region and how to degrade gracefully when roof data is missing).

5. Technical stack recommendation
Recommend a pragmatic modern stack for a lean startup. Include frontend, backend, database, geospatial/data processing, queue/jobs, analytics, CRM/lead-handoff tooling, deployment (EU region hosting for GDPR). Prefer simple, maintainable choices and explain why.

6. Data model
Design the main entities and fields for:
- Address / Property
- RoofData (source, coverage quality, fallback level)
- SuitabilityScore
- SolarEstimate
- Lead (with consent records)
- InstallerPartner
- LeadAssignment (which installer, price, status, outcome)
- ConsentLog
- AuditLog

Show this as TypeScript interfaces or a Prisma-style schema.

7. Scoring logic
Propose an explainable V1 scoring model for solar suitability using only lawfully available data:
- usable roof area estimate (from Solar API / Solarkataster / OSM footprint heuristic)
- roof orientation and tilt where available
- shading estimate where available
- regional irradiance (PVGIS)
- data confidence level (which source answered)

Output: solarFitScore, estimatedCapacityKw, confidenceScore. Define explicit fallback tiers: full roof data → footprint-only heuristic → region-level default. Keep it heuristic and transparent.

8. Savings estimator (German model)
Design a conservative estimation model with German economics:
- specific yield from PVGIS (kWh/kWp per region, typically ~950-1100 in Germany)
- household consumption bands (user-selected: e.g. 2500/3500/4500/6000 kWh)
- Eigenverbrauchsquote assumptions (~25-40% without battery)
- household electricity price assumption (configurable, ~30 ct/kWh)
- EEG Einspeisevergütung for surplus feed-in (configurable, ~8 ct/kWh, note degression)
- system cost range per kWp at 0% VAT
Output: estimated annual production range, annual savings range (self-consumption savings + feed-in revenue), payback range. All as ranges, all labeled unverbindlich. Make assumptions configurable, not hardcoded.

9. Visuals (V1: generic, not house-specific)
- Score card / result page design: how to present score, capacity, savings convincingly WITHOUT a personalized roof image
- High-quality generic imagery and trust elements
- Optional V2: display existing public Solarkataster overlay or Google Solar API roof segments for the entered address (display of public data, not generated mockups)
- Explicitly NO generative or composited house-specific mockups in V1

10. User flow
Write the end-to-end funnel:
- ad/SEO/organic entry → landing page → address input → instant result (score + savings) → lead form with consent checkboxes → double opt-in confirmation → human qualification call → lead offered to matching installer(s) → installer accepts → handoff → outcome feedback loop (did it become a quote/sale?)
Also the installer-side flow: onboarding, region/capacity preferences, lead delivery, acceptance/rejection, billing.

11. Landing page requirements
Design the landing page (German copy). Include:
- hero with address input as the primary CTA ("Lohnt sich Solar für Ihr Dach?")
- instant result section: score, estimated kWp, savings range
- trust/disclaimer section (unverbindliche Schätzung, data sources, GDPR notice)
- lead form with separate consent checkboxes (contact consent, lead-sharing consent)
- FAQ addressing German homeowner concerns (cost, Einspeisevergütung, permits, Denkmalschutz, renter vs owner)
Write sample German copy that feels helpful and trustworthy, with English translations.

12. Metrics
Define key funnel and business metrics:
- visit → address-check rate
- address-check → result-view rate
- result → form completion rate
- double opt-in confirmation rate
- qualified lead rate
- installer acceptance rate
- revenue per lead, CAC per qualified lead
- lead-to-quote and lead-to-sale feedback from installers
- estimate accuracy feedback loop

13. Repo structure
Propose a clean monorepo structure for this MVP. Include folders and what goes in each.

14. Build plan
A detailed 6-week implementation roadmap, week by week, with concrete deliverables, assuming the pilot runs with manually onboarded installers (no self-serve installer portal yet).

15. Code scaffolding
Generate starter TypeScript scaffolding:
- backend API structure (address check endpoint, estimate endpoint, lead capture endpoint)
- Prisma/ORM schema for the data model above
- scoring service with fallback tiers
- savings estimator service with configurable German assumptions
- consent logging on lead capture
- simple frontend page structure (landing → result → form → confirmation)
- environment variable template (PVGIS/Solar API keys, region config)

16. Prioritized next steps
End with:
- the 5 fastest things to build first
- the 5 biggest product risks (include: lead quality skepticism from installers, data coverage gaps, CAC vs lead price economics)
- the 5 biggest compliance mistakes to avoid in Germany

Additional instructions:
- Be concrete and implementation-oriented; boring, reliable architecture over fancy complexity.
- Call out all assumptions explicitly (especially economic assumptions that change over time, like Einspeisevergütung rates).
- If a component is uncertain, propose a V1 workaround.
- Use tables where helpful and sample TypeScript code blocks where appropriate.
- Assume a small team: 1 full-stack engineer, 1 growth operator, 1 sales person (who also manages installer relationships).
```

## Key open decisions

1. **Pilot state**: NRW recommended (largest population + mature open Solarkataster). Using Google Solar API removes the state constraint but costs per query.
2. **Lead economics**: qualified solar leads sell for ~€50–150 in Germany. CAC vs. lead price is the first thing to validate in the pilot — before polishing software.
