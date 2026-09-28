import { CONTROLLER } from "@/lib/site";

/**
 * Kostra právních stránek učebny (`/ochrana-udaju`, `/podminky`).
 *
 * Čte je hlavně rodič, který si chce ověřit, komu svěřuje údaje dítěte.
 * Proto krátké oddíly s nadpisy, žádná zeď textu — a správce nahoře,
 * ne až v patičce.
 */
export function LegalDoc({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="section-container py-12 sm:py-16">
      <article className="max-w-3xl">
        <h1 className="heading-2 mb-3">{title}</h1>
        <p className="mb-8 text-sm text-ink-500">Platné od {updated}</p>

        <div className="mb-10 rounded-md border border-ink bg-paper p-5 shadow-hard-sm">
          <p className="font-semibold">{CONTROLLER.name}</p>
          <p className="text-ink-500">
            IČO {CONTROLLER.ico} · {CONTROLLER.address}
          </p>
          <p className="text-ink-500">Zapsaná v obchodním rejstříku, {CONTROLLER.court}</p>
          <p className="mt-2">
            <a
              href={`mailto:${CONTROLLER.email}`}
              className="font-semibold text-primary-700 underline underline-offset-4"
            >
              {CONTROLLER.email}
            </a>
          </p>
        </div>

        <div className="space-y-8 leading-relaxed text-ink-700 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-2 [&_ul]:space-y-1">
          {children}
        </div>
      </article>
    </main>
  );
}
