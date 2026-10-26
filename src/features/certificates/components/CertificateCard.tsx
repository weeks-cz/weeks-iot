import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Card } from "@/components/ui/Surface";
import { formatCertificateDate, MAX_CERTIFICATE_NAME, type CertificateData } from "../document";
import { CertificateFace } from "./CertificateFace";

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
  lessons,
}: {
  childId: string;
  courseSlug: string;
  data: CertificateData;
  /** Počet publikovaných lekcí kurzu, pro pečeť na líci. */
  lessons: number;
}) {
  const href = `/ucet/certifikat/${childId}/${courseSlug}/`;

  return (
    <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,22rem)_1fr]">
      {/* Zmenšenina A4 na šířku — stejný líc jako 3D certifikát ve finále. */}
      <CertificateFace data={data} lessons={lessons} compact />

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
            hint="Místo přezdívky třeba celé jméno — nikam ho neukládáme, jde jen do tohohle PDF."
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
