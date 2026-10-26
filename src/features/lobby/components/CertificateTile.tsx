import Link from "next/link";
import { Lock } from "lucide-react";
import type { EarnedCertificate } from "@/features/certificates/queries";
import { CertificateFace } from "@/features/certificates/components/CertificateFace";
import { plural } from "../copy";

const LINK_TEXT =
  "inline-flex min-h-11 w-fit items-center gap-2 rounded-sm font-semibold text-primary-700 " +
  "underline-offset-4 hover:underline";
const LINK = `mt-4 ${LINK_TEXT}`;

/**
 * Certifikát v lobby — stejný líc jako v účtu a ve finále.
 *
 * Před dokončením kurzu vybledlý se zámkem „po lekci N" (N = počet
 * publikovaných lekcí, nic napevno). Vydaný je plný a otevře PDF.
 */
export function CertificateTile({
  certificate,
  pdfHref,
  nick,
  course,
  lessons,
  remaining,
}: {
  certificate: EarnedCertificate | null;
  /** `/ucet/certifikat/{dítě}/{kurz}/` — route sama ověří vlastnictví profilu. */
  pdfHref: string;
  nick: string;
  course: { title: string; projectTitle: string };
  /** Počet publikovaných lekcí kurzu. */
  lessons: number;
  /** Kolik lekcí do certifikátu chybí. */
  remaining: number;
}) {
  return (
    <section className="card-maker flex h-full flex-col p-5">
      <h2 className="mono-label mb-4">Certifikát</h2>

      <div className="flex-1">
        {certificate ? (
          <a
            href={pdfHref}
            target="_blank"
            rel="noopener"
            aria-label="Otevřít certifikát (PDF, nové okno)"
            className="block rounded-sm transition-transform duration-200 hover:-translate-y-0.5"
          >
            <CertificateFace data={certificate.data} lessons={certificate.lessons} compact />
          </a>
        ) : (
          <div className="relative">
            <div className={remaining > 0 ? "opacity-55 grayscale" : undefined}>
              <CertificateFace
                data={null}
                placeholderName={nick}
                lessons={lessons}
                course={course}
                compact
              />
            </div>
            {remaining > 0 && (
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 border border-ink/15 bg-paper-soft px-2 py-1 font-mono text-xs text-ink-500">
                <Lock aria-hidden="true" className="size-3.5" />
                po lekci {lessons}
              </span>
            )}
          </div>
        )}
      </div>

      {certificate ? (
        <a href={pdfHref} target="_blank" rel="noopener" className={LINK}>
          Otevřít PDF <span aria-hidden="true">↗</span>
        </a>
      ) : remaining > 0 ? (
        <p className="mt-4 flex min-h-11 items-center text-sm text-ink-500">
          Chybí ti ještě {remaining} {plural(remaining, "lekce", "lekce", "lekcí")}.
        </p>
      ) : (
        /* Kurz je hotový, ale certifikát se nenačetl. Dlaždice stojí i ve
           sbírce, takže odkaz „do sbírky" by vedl na tutéž stránku — účet rodiče
           certifikáty počítá sám a funguje vždycky. */
        <div className="mt-4">
          <p className="text-sm text-ink-500">Certifikát se nenačetl, zkus to za chvíli znovu.</p>
          <Link href="/ucet" className={LINK_TEXT}>
            Účet rodiče <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}
    </section>
  );
}
