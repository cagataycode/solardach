import Link from "next/link";

export default function ConfirmedPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 pt-20 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pine text-3xl text-cream">
        ✓
      </div>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Anfrage bestätigt
      </h1>
      <p className="mx-auto mt-4 max-w-md text-ink/70">
        Vielen Dank! Ihre Anfrage ist nun bestätigt. Ein Mitglied unseres Teams
        meldet sich in Kürze bei Ihnen, um die nächsten Schritte zu besprechen.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-xl bg-pine px-6 py-3 font-semibold text-cream transition hover:bg-pine-deep"
      >
        Zurück zur Startseite
      </Link>
    </main>
  );
}
