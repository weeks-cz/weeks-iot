import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/Surface";
import { formatCertificateDate, MAX_CERTIFICATE_NAME, type CertificateData } from "../document";

/**
 * Certifikát v účtu: zmenšenina, otevření a stažení se jménem.
 *
 * Zmenšenina je HTML, ne vložené PDF. Stránky učebny posílají
 * `frame-ancestors 'none'` (a `object-src 'none'`), takže PDF v iframu by
 * prohlížeč odmítl — a na telefonu by se v rámečku stejně nedalo číst.
 * Text bere z téhož `CertificateData` jako PDF, takže se nerozejdou.
 *
 * Formulář je obyčejný HTML POST bez JavaScriptu: jméno odejde rovnou do
 * odpovědi s PDF a nikde se neuloží.
 */
export function CertificateCard({
  childId,
  courseSlug,
  data,
}: {
  childId: string;
  courseSlug: string;
  data: CertificateData;
}) {
  const href = `/ucet/certifikat/${childId}/${courseSlug}/`;

  return (
    <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,22rem)_1fr]">
      {/* Zmenšenina A4 na šířku. */}
      <div
        aria-hidden="true"
        className="relative aspect-[297/210] overflow-hidden rounded-sm border border-ink/10 bg-paper p-[6%] font-display"
      >
        <span className="pointer-events-none absolute -right-[12%] -top-[28%] select-none text-[18rem] font-bold leading-none text-primary-50">
          W
        </span>
        <div className="relative flex h-full flex-col">
          <p className="text-[0.7rem] font-bold text-ink">
            Weeks <span className="ml-1 text-[0.5rem] tracking-[0.2em] text-primary-600">UČEBNA</span>
          </p>
          <div className="flex flex-1 flex-col justify-center">
            <p className="text-[0.6rem] font-bold text-primary-600">Certifikát</p>
            <p className="truncate text-2xl font-bold leading-tight text-ink">{data.name}</p>
            <p className="mt-1 text-[0.55rem] text-ink-500">za dokončení kurzu</p>
            <p className="text-sm font-bold text-ink">{data.courseTitle}</p>
          </div>
          <div className="flex items-end justify-between border-t border-ink pt-1 text-[0.5rem]">
            <span className="text-ink-500">Dokončeno {formatCertificateDate(data.completedAt)}</span>
            <span className="text-right font-bold text-ink">Weeks s.r.o.</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h3 className="heading-3 mb-1">{data.courseTitle}</h3>
          <p className="text-sm text-ink-500">
            {data.name} · dokončeno {formatCertificateDate(data.completedAt)} · projekt{" "}
            {data.projectTitle}
          </p>
        </div>

        <a
          href={href}
          target="_blank"
          rel="noopener"
          className="w-fit rounded-sm text-sm font-semibold text-primary-700 underline underline-offset-4 hover:text-ink"
        >
          Otevřít PDF
        </a>

        <form method="post" action={href} className="flex flex-col gap-3 sm:max-w-sm">
          <TextField
            name="jmeno"
            label="Jméno na certifikátu"
            hint="Nepovinné. Místo přezdívky třeba celé jméno — nikam ho neukládáme, jde jen do tohohle PDF."
            maxLength={MAX_CERTIFICATE_NAME}
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" className="w-fit">
            Stáhnout PDF
          </Button>
        </form>
      </div>
    </Card>
  );
}
