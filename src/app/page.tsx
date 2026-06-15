import SolarCheck from "@/components/SolarCheck";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Was kostet eine Solaranlage?",
    a: "Eine typische Anlage für ein Einfamilienhaus (8–10 kWp) kostet schlüsselfertig etwa 11.000–18.000 €. Seit 2023 gilt dafür 0 % Mehrwertsteuer. Die genaue Summe hängt von Dach, Komponenten und Region ab — unsere Zahlen sind eine erste Orientierung.",
  },
  {
    q: "Wie funktioniert die Einspeisevergütung?",
    a: "Strom, den Sie nicht selbst verbrauchen, speisen Sie ins Netz ein und erhalten dafür die EEG-Einspeisevergütung (derzeit rund 8 ct/kWh bei Teileinspeisung, mit regelmäßiger Degression). Der größte Spareffekt entsteht aber durch den selbst verbrauchten Strom.",
  },
  {
    q: "Brauche ich eine Genehmigung?",
    a: "Für die meisten Aufdachanlagen ist keine Baugenehmigung nötig. Ausnahmen gibt es bei denkmalgeschützten Gebäuden und in manchen Bebauungsplänen — das prüft der Fachbetrieb für Sie.",
  },
  {
    q: "Ich bin Mieter:in — geht das trotzdem?",
    a: "Eine Dachanlage kann nur mit Zustimmung der Eigentümer:innen installiert werden. Als Mieter:in kommt für Sie ggf. ein Balkonkraftwerk in Frage — das ist aber nicht Teil dieses Checks.",
  },
  {
    q: "Wie genau ist diese Schätzung?",
    a: "Unsere Berechnung nutzt öffentliche Daten (PVGIS-Einstrahlung, Gebäudedaten aus OpenStreetMap bzw. Satellitenanalyse) und konservative Annahmen. Sie ist eine unverbindliche Ersteinschätzung — die verbindliche Auslegung macht ein Fachbetrieb vor Ort.",
  },
  {
    q: "Was passiert mit meinen Daten?",
    a: "Ihre Adresse wird nur für die Berechnung verwendet. Kontaktdaten speichern wir erst, wenn Sie das Formular absenden und beiden Einwilligungen aktiv zustimmen. Die Weitergabe erfolgt ausschließlich an einen passenden Fachbetrieb — und Sie können jede Einwilligung jederzeit widerrufen.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      {/* Hero */}
      <section className="pt-10 sm:pt-16">
        <p className="rise rise-1 text-sm font-medium uppercase tracking-[0.2em] text-sun-deep">
          Kostenloser Solar-Check in 30 Sekunden
        </p>
        <h1 className="rise rise-1 font-display mt-4 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Lohnt sich Solar
          <br />
          für <em className="text-pine not-italic underline decoration-sun decoration-8 underline-offset-4">Ihr Dach</em>?
        </h1>
        <p className="rise rise-2 mt-6 max-w-xl text-lg text-ink/70">
          Adresse eingeben und sofort sehen, wie gut sich Ihr Dach für
          Photovoltaik eignet — mit realistischer Ersparnis-Spanne statt
          Verkaufsversprechen.
        </p>

        <div className="mt-10">
          <SolarCheck />
        </div>
      </section>

      {/* Trust strip */}
      <section className="rise rise-4 mt-16 grid gap-6 rounded-3xl border border-pine/10 bg-parchment/70 p-8 sm:grid-cols-3">
        {[
          {
            title: "Öffentliche Daten, keine Tricks",
            text: "Berechnung mit PVGIS (EU-Kommission) und OpenStreetMap. Wir zeigen Ihnen immer, welche Datenquelle geantwortet hat.",
          },
          {
            title: "Konservative Spannen",
            text: "Alle Zahlen sind unverbindliche Schätzungen mit Bandbreiten — keine geschönten Garantiewerte.",
          },
          {
            title: "Sie behalten die Kontrolle",
            text: "Kontakt nur nach Ihrer ausdrücklichen Einwilligung mit Double-Opt-In. Weitergabe nur an einen geprüften Fachbetrieb.",
          },
        ].map((item) => (
          <div key={item.title}>
            <h3 className="font-display text-lg font-semibold text-pine">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/70">{item.text}</p>
          </div>
        ))}
      </section>

      {/* FAQ */}
      <section className="mt-20">
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Häufige Fragen
        </h2>
        <div className="mt-6 divide-y divide-ink/10">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                {item.q}
                <span className="text-sun-deep transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/70">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
