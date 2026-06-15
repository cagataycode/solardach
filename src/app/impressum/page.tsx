export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pt-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Impressum
      </h1>
      <div className="prose mt-6 text-ink/80">
        <p>
          {/* TODO: Vor dem Launch mit echten Unternehmensdaten füllen (§ 5 DDG). */}
          Angaben gemäß § 5 DDG folgen vor dem öffentlichen Launch: Name und
          Anschrift des Betreibers, Vertretungsberechtigte, Kontakt,
          Registereintrag, USt-IdNr.
        </p>
      </div>
    </main>
  );
}
