"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const Building3D = dynamic(() => import("./Building3D"), { ssr: false });

interface CheckResult {
  checkId: string;
  address: string;
  roofDataTier: "LOD2" | "SOLAR_API" | "OSM_FOOTPRINT" | "REGION_DEFAULT";
  usableRoofAreaM2: number;
  orientation: string;
  panelCount: number | null;
  solarFitScore: number;
  estimatedCapacityKw: number;
  confidenceScore: number;
  estimate: {
    annualProductionKwhLow: number;
    annualProductionKwhHigh: number;
    annualSavingsEurLow: number;
    annualSavingsEurHigh: number;
    paybackYearsLow: number;
    paybackYearsHigh: number;
  };
}

type Phase = "idle" | "checking" | "result" | "submitting" | "done";

const TIER_LABEL: Record<CheckResult["roofDataTier"], string> = {
  LOD2: "Dachdaten: amtliches 3D-Gebäudemodell (LoD2)",
  SOLAR_API: "Dachdaten: Satellitenanalyse",
  OSM_FOOTPRINT: "Dachdaten: Gebäudegrundriss (OpenStreetMap)",
  REGION_DEFAULT: "Dachdaten: regionaler Durchschnittswert",
};

const CONSUMPTION_BANDS = [
  { value: 2500, label: "1–2 Personen (~2.500 kWh)" },
  { value: 3500, label: "3 Personen (~3.500 kWh)" },
  { value: 4500, label: "4 Personen (~4.500 kWh)" },
  { value: 6000, label: "5+ Personen / Wärmepumpe (~6.000 kWh)" },
];

const eur = (n: number) => n.toLocaleString("de-DE");

export default function SolarCheck() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [address, setAddress] = useState("");
  const [band, setBand] = useState(3500);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isOwner, setIsOwner] = useState(true);
  const [timeframe, setTimeframe] = useState("3-12m");
  const [consentContact, setConsentContact] = useState(false);
  const [consentSharing, setConsentSharing] = useState(false);

  async function runCheck(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("checking");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, consumptionBandKwh: band }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unbekannter Fehler.");
      setResult(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      setPhase("idle");
    }
  }

  async function submitLead(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setError(null);
    setPhase("submitting");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkId: result.checkId,
          name,
          email,
          phone: phone || undefined,
          isOwner,
          plannedTimeframe: timeframe,
          consentContact,
          consentLeadSharing: consentSharing,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unbekannter Fehler.");
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
      setPhase("result");
    }
  }

  if (phase === "done") {
    return (
      <div className="rise rounded-3xl border border-pine/15 bg-white/70 p-10 text-center shadow-[0_24px_60px_-30px_rgb(27_58_36/0.4)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-pine text-2xl text-cream">
          ✓
        </div>
        <h3 className="font-display text-3xl font-semibold">Fast geschafft!</h3>
        <p className="mx-auto mt-3 max-w-md text-ink/70">
          Wir haben Ihnen eine E-Mail geschickt. Bitte bestätigen Sie dort Ihre
          Anfrage (Double-Opt-In) — erst danach melden wir uns bei Ihnen.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Address input */}
      <form
        onSubmit={runCheck}
        className="rise rise-2 flex flex-col gap-3 rounded-3xl border border-pine/15 bg-white/80 p-4 shadow-[0_24px_60px_-30px_rgb(27_58_36/0.35)] sm:p-5"
      >
        <label htmlFor="address" className="px-1 text-sm font-medium text-pine">
          Ihre Adresse (nur Deutschland)
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="address"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="z. B. Musterstraße 12, 50667 Köln"
            className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-3.5 text-base outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/20"
          />
          <button
            type="submit"
            disabled={phase === "checking"}
            className="shrink-0 rounded-xl bg-pine px-6 py-3.5 font-semibold text-cream transition hover:bg-pine-deep disabled:opacity-60"
          >
            {phase === "checking" ? "Prüfe Dach …" : "Jetzt prüfen"}
          </button>
        </div>
        <select
          value={band}
          onChange={(e) => setBand(Number(e.target.value))}
          className="rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm outline-none focus:border-pine"
          aria-label="Haushaltsgröße / Stromverbrauch"
        >
          {CONSUMPTION_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <p className="px-1 text-xs text-ink/50">
          Kostenlos & unverbindlich. Ihre Adresse wird nur für die Berechnung
          verwendet — keine Speicherung von Kontaktdaten ohne Ihre Einwilligung.
        </p>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-clay/30 bg-clay/10 px-4 py-3 text-sm text-clay">
          {error}
        </p>
      )}

      {/* Result */}
      {result && (phase === "result" || phase === "submitting") && (
        <div className="mt-8 space-y-6">
          {result.roofDataTier === "LOD2" && (
            <Building3D checkId={result.checkId} />
          )}
          <div className="rise rounded-3xl border border-pine/15 bg-pine-deep p-6 text-cream shadow-[0_30px_70px_-30px_rgb(27_58_36/0.6)] sm:p-8">
            <p className="text-sm uppercase tracking-widest text-cream/60">
              Ergebnis für
            </p>
            <h3 className="font-display mt-1 text-2xl font-semibold">
              {result.address}
            </h3>

            <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr]">
              <ScoreRing score={result.solarFitScore} />
              <div className="grid grid-cols-2 gap-4 self-center">
                <Stat
                  label="Mögliche Anlagengröße"
                  value={
                    result.panelCount
                      ? `${result.panelCount} Module · ~${result.estimatedCapacityKw.toLocaleString("de-DE")} kWp`
                      : `~${result.estimatedCapacityKw.toLocaleString("de-DE")} kWp`
                  }
                />
                <Stat
                  label="Stromproduktion / Jahr"
                  value={`${eur(result.estimate.annualProductionKwhLow)}–${eur(result.estimate.annualProductionKwhHigh)} kWh`}
                />
                <Stat
                  label="Ersparnis / Jahr"
                  value={`${eur(result.estimate.annualSavingsEurLow)}–${eur(result.estimate.annualSavingsEurHigh)} €`}
                  highlight
                />
                <Stat
                  label="Amortisation"
                  value={`${result.estimate.paybackYearsLow}–${result.estimate.paybackYearsHigh} Jahre`}
                />
              </div>
            </div>

            <p className="mt-6 border-t border-cream/15 pt-4 text-xs leading-relaxed text-cream/60">
              {TIER_LABEL[result.roofDataTier]} · Datenvertrauen:{" "}
              {result.confidenceScore} % · Unverbindliche Schätzung auf Basis
              öffentlicher Daten (PVGIS, OpenStreetMap). Keine Garantie — die
              tatsächliche Eignung prüft ein Fachbetrieb vor Ort.
            </p>
          </div>

          {/* Lead form */}
          <form
            onSubmit={submitLead}
            className="rise rise-1 rounded-3xl border border-pine/15 bg-white/80 p-6 sm:p-8"
          >
            <h3 className="font-display text-2xl font-semibold">
              Kostenlose Einschätzung vom Fachbetrieb
            </h3>
            <p className="mt-2 text-sm text-ink/70">
              Wir verbinden Sie mit einem geprüften Solar-Fachbetrieb aus Ihrer
              Region — unverbindlich und ohne Kosten.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ihr Name *"
                className="rounded-xl border border-ink/15 bg-cream px-4 py-3 outline-none focus:border-pine"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-Mail *"
                className="rounded-xl border border-ink/15 bg-cream px-4 py-3 outline-none focus:border-pine"
              />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefon (optional)"
                className="rounded-xl border border-ink/15 bg-cream px-4 py-3 outline-none focus:border-pine"
              />
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="rounded-xl border border-ink/15 bg-cream px-4 py-3 outline-none focus:border-pine"
              >
                <option value="0-3m">Umsetzung in 0–3 Monaten</option>
                <option value="3-12m">Umsetzung in 3–12 Monaten</option>
                <option value="researching">Ich informiere mich erst</option>
              </select>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-ink/80">
              <input
                type="checkbox"
                checked={isOwner}
                onChange={(e) => setIsOwner(e.target.checked)}
                className="h-4 w-4 accent-pine"
              />
              Ich bin Eigentümer:in dieser Immobilie
            </label>

            <div className="mt-5 space-y-3 rounded-xl bg-parchment/80 p-4 text-xs leading-relaxed text-ink/75">
              <label className="flex items-start gap-2.5">
                <input
                  required
                  type="checkbox"
                  checked={consentContact}
                  onChange={(e) => setConsentContact(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-pine"
                />
                Ich stimme zu, dass solar-dach mich per E-Mail oder Telefon zu
                meiner Solar-Anfrage kontaktiert. Diese Einwilligung kann ich
                jederzeit widerrufen. *
              </label>
              <label className="flex items-start gap-2.5">
                <input
                  required
                  type="checkbox"
                  checked={consentSharing}
                  onChange={(e) => setConsentSharing(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-pine"
                />
                Ich stimme zu, dass meine Anfrage und Kontaktdaten an einen
                passenden Solar-Fachbetrieb in meiner Region weitergegeben
                werden, damit dieser mir ein Angebot erstellen kann. Diese
                Einwilligung kann ich jederzeit widerrufen. *
              </label>
            </div>

            <button
              type="submit"
              disabled={phase === "submitting"}
              className="mt-6 w-full rounded-xl bg-sun px-6 py-4 font-semibold text-ink transition hover:bg-sun-deep disabled:opacity-60 sm:w-auto"
            >
              {phase === "submitting"
                ? "Wird gesendet …"
                : "Kostenlose Einschätzung anfordern"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const verdict =
    score >= 75 ? "Sehr gut geeignet" : score >= 55 ? "Gut geeignet" : score >= 35 ? "Bedingt geeignet" : "Eher ungeeignet";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgb(250 245 234 / 0.15)" strokeWidth="10" />
          <circle
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke="var(--color-sun)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="ring-animate"
            style={{ "--ring-circumference": c } as React.CSSProperties}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-semibold">{score}</span>
          <span className="text-xs text-cream/60">von 100</span>
        </div>
      </div>
      <span className="rounded-full bg-sun/15 px-3 py-1 text-xs font-medium text-sun">
        {verdict}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-cream/55">{label}</p>
      <p
        className={`font-display mt-1 text-xl font-semibold ${highlight ? "text-sun" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
