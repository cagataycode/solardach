export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pt-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Datenschutzerklärung
      </h1>
      <div className="mt-6 space-y-4 text-ink/80">
        <p>
          {/* TODO: Vor dem Launch von einer Fachperson prüfen lassen. */}
          Diese Datenschutzerklärung wird vor dem öffentlichen Launch
          vervollständigt. Sie wird mindestens umfassen:
        </p>
        <ul className="list-disc space-y-2 pl-6 text-sm">
          <li>Verantwortlicher und Kontaktdaten</li>
          <li>
            Verarbeitung der Adresseingabe (Berechnung, Rechtsgrundlage Art. 6
            Abs. 1 lit. b/f DSGVO)
          </li>
          <li>
            Verarbeitung von Kontaktdaten nach Einwilligung (Art. 6 Abs. 1
            lit. a DSGVO), inkl. Widerrufsrecht
          </li>
          <li>
            Weitergabe an Solar-Fachbetriebe nur nach ausdrücklicher,
            gesonderter Einwilligung
          </li>
          <li>Speicherdauer und Löschkonzept</li>
          <li>Betroffenenrechte (Auskunft, Berichtigung, Löschung, Beschwerde)</li>
          <li>Eingesetzte Drittdienste (Geocoding, PVGIS) und Hosting in der EU</li>
        </ul>
      </div>
    </main>
  );
}
