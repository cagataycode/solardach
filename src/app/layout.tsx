import type { Metadata } from "next";
import { Fraunces, Instrument_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: "solar-dach — Lohnt sich Solar für Ihr Dach?",
  description:
    "Kostenloser Solar-Check für Ihr Zuhause: Adresse eingeben, unverbindliche Einschätzung zu Eignung, Anlagengröße und Ersparnis erhalten.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${fraunces.variable} ${instrument.variable}`}>
      <body className="min-h-screen antialiased">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
            solar<span className="text-sun-deep">–</span>dach
          </Link>
          <span className="rounded-full border border-pine/20 px-3 py-1 text-xs font-medium uppercase tracking-widest text-pine">
            Pilotphase
          </span>
        </header>
        {children}
        <footer className="mt-24 border-t border-ink/10 bg-parchment/60">
          <div className="mx-auto max-w-5xl px-6 py-10 text-sm text-ink/70">
            <p className="mb-4 max-w-2xl">
              Alle Angaben auf dieser Seite sind unverbindliche Schätzungen auf
              Basis öffentlich verfügbarer Daten. Sie ersetzen keine technische
              Prüfung vor Ort und stellen kein Angebot dar.
            </p>
            <div className="flex gap-6">
              <Link href="/impressum" className="underline underline-offset-4 hover:text-ink">
                Impressum
              </Link>
              <Link href="/datenschutz" className="underline underline-offset-4 hover:text-ink">
                Datenschutz
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
