import { cn } from "@/lib/cn";
import { formatCertificateDate, type CertificateData } from "../document";

/** Od kolika znaků se jméno zmenší, aby se vešlo na dva řádky. */
const LONG_NAME = 14;

/**
 * Líc certifikátu — čisté HTML, stejná data jako PDF (`CertificateData`),
 * ať se náhled a stažený soubor nerozejdou.
 *
 * Všechny rozměry jsou v `cqw` (procenta šířky líce), takže zmenšenina
 * v účtu, dlaždice v lobby i velký certifikát ve finále vypadají stejně,
 * jen v jiném měřítku.
 *
 * Hloubku pro 3D (`CertificateStage`) líc jen nabízí přes proměnné
 * `--cert-depth-text` a `--cert-depth-seal`; sám je plochý. Kořen proto
 * nesmí mít `overflow: hidden` — zploštil by `preserve-3d` a náklon by
 * ztratil paralaxu. Vodoznak W ořezává vlastní vrstva papíru.
 *
 * `data === null` je anonym (návrh §6.4): místo jména vybledlé „Tvoje
 * jméno", bez data — certifikát ještě nikdo nevydal. Název kurzu
 * a projekt pak může dodat `course`.
 */
export function CertificateFace({
  data,
  placeholderName,
  lessons,
  compact = false,
  course,
}: {
  data: CertificateData | null;
  placeholderName?: string;
  /** Počet publikovaných lekcí kurzu — pečeť „7 / 7 lekcí". */
  lessons: number;
  /** Zmenšenina: tenký rámeček bez tvrdého stínu. */
  compact?: boolean;
  /** Kurz pro anonyma, který nemá `CertificateData`. */
  course?: { title: string; projectTitle: string };
}) {
  const name = data?.name ?? placeholderName ?? "Tvoje jméno";
  const courseTitle = data?.courseTitle ?? course?.title;
  const projectTitle = data?.projectTitle ?? course?.projectTitle;
  const footer = [
    data && `Dokončeno ${formatCertificateDate(data.completedAt)}`,
    projectTitle && `projekt ${projectTitle}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      aria-hidden="true"
      className={cn(
        "@container relative aspect-[297/210] w-full select-none bg-paper font-display text-ink [transform-style:preserve-3d]",
        compact
          ? "rounded-sm border border-ink/10"
          : "border-2 border-ink shadow-[10px_10px_0_0_var(--color-cta-600)]",
      )}
    >
      {/* Papír s vodoznakem. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/weeks-w.png"
          alt=""
          width={143}
          height={96}
          className="absolute -right-[11.5cqw] -top-[9.6cqw] h-[58cqw] w-auto max-w-none opacity-[0.13]"
        />
      </div>

      <div
        className="relative flex h-full flex-col px-[8cqw] py-[7cqw]"
        style={{ transform: "var(--cert-depth-text, none)" }}
      >
        <div className="flex items-center gap-[1.5cqw]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/weeks-w.png" alt="" width={143} height={96} className="h-[3.5cqw] w-auto" />
          <span className="text-[2.9cqw] font-extrabold leading-none">Weeks</span>
          <span className="font-mono text-[1.55cqw] font-medium leading-none tracking-[0.22em] text-primary-600">
            UČEBNA
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p className="text-[2.5cqw] font-bold tracking-[0.02em] text-primary-600">Certifikát</p>
          <p
            className={cn(
              /* line-clamp ořezává (overflow: hidden): řádkování 1.1 a malý
                 okraj nechají místo háčkům nad Č/Š/Ž i dolním tahům ý/p/g. */
              "line-clamp-2 break-words py-[0.08em] font-extrabold leading-[1.1] tracking-[-0.03em]",
              name.length > LONG_NAME ? "text-[6.5cqw]" : "text-[10cqw]",
              !data && "text-ink/40",
            )}
          >
            {name}
          </p>
          <p className="mt-[1.5cqw] font-sans text-[2.3cqw] text-ink-500">za dokončení kurzu</p>
          {courseTitle && (
            <p className="pr-[16cqw] text-[4.2cqw] font-extrabold leading-tight">{courseTitle}</p>
          )}
        </div>

        <div
          className={cn(
            "flex items-end justify-between gap-[2cqw] border-t-ink pt-[1.15cqw] font-sans text-[1.9cqw]",
            compact ? "border-t" : "border-t-2",
          )}
        >
          <span>{footer}</span>
          <span className="shrink-0 font-bold">Weeks s.r.o.</span>
        </div>
      </div>

      <div
        className="absolute bottom-[18%] right-[8%] grid size-[15cqw] place-items-center rounded-full border-2 border-ink bg-cta-400 text-center font-mono text-[1.75cqw] font-medium uppercase leading-tight tracking-[0.1em] shadow-[3px_3px_0_0_var(--color-ink)]"
        style={{ transform: "var(--cert-depth-seal,) rotate(-12deg)" }}
      >
        <span>
          {`${lessons} / ${lessons}`}
          <br />
          {lessons === 1 ? "lekce" : "lekcí"}
        </span>
      </div>
    </div>
  );
}
