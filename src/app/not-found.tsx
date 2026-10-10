import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/Surface";

export const metadata: Metadata = {
  title: "Stránka nenalezena",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="section-container flex min-h-[70dvh] flex-col items-start justify-center gap-6 py-16">
      <MonoLabel>Chyba 404</MonoLabel>
      <h1 className="heading-2 max-w-xl">Tuhle stránku jsme nenašli</h1>
      <p className="max-w-lg text-ink-500">
        Možná se adresa změnila, nebo jste zadali něco blízkého, ale ne přesného. Lekce
        čekají na prvním místě.
      </p>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/kurz/iot/" variant="primary">
          Na lekce
        </ButtonLink>
        <ButtonLink href="/" variant="outline">
          Úvodní stránka
        </ButtonLink>
      </div>
    </main>
  );
}
