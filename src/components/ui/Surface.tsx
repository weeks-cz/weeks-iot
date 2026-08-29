import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ── Karta ─────────────────────────────────────────────────────────────── */

export function Card({
  children,
  className,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  /** Zapne tvrdý stín a rohové registrační značky na hover. */
  interactive?: boolean;
}) {
  return (
    <div className={cn("card-maker", interactive && "card-maker-hover", className)}>{children}</div>
  );
}

/* ── Technický popisek ─────────────────────────────────────────────────── */

export function MonoLabel({
  children,
  dark,
  className,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return <p className={cn(dark ? "mono-label-dark" : "mono-label", className)}>{children}</p>;
}

/* ── Odznak ────────────────────────────────────────────────────────────── */

type BadgeTone = "neutral" | "primary" | "trust" | "cta" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-ink/25 text-ink-500 bg-white",
  primary: "border-primary-600 text-primary-700 bg-primary-50",
  trust: "border-trust-600 text-trust-700 bg-trust-50",
  cta: "border-cta-600 text-cta-800 bg-cta-50",
  danger: "border-danger-500 text-danger-700 bg-danger-50",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1",
        "font-mono text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Hláška ────────────────────────────────────────────────────────────── */

type AlertTone = "info" | "success" | "warning" | "danger";

const ALERT_TONES: Record<AlertTone, { box: string; title: string }> = {
  info: { box: "border-primary-600 bg-primary-50", title: "text-primary-800" },
  success: { box: "border-trust-600 bg-trust-50", title: "text-trust-800" },
  warning: { box: "border-cta-600 bg-cta-50", title: "text-cta-900" },
  danger: { box: "border-danger-500 bg-danger-50", title: "text-danger-700" },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const styles = ALERT_TONES[tone];

  return (
    <div
      /* Chyba se oznamuje hned (assertive), zbytek počká na pauzu v řeči.
         Kdyby všechno bylo assertive, přerušovalo by to čtení formuláře. */
      role={tone === "danger" ? "alert" : "status"}
      aria-live={tone === "danger" ? "assertive" : "polite"}
      className={cn("rounded-md border-l-4 border border-ink/15 p-4", styles.box, className)}
    >
      {title && <p className={cn("mb-1 font-semibold", styles.title)}>{title}</p>}
      {children && <div className="text-sm leading-relaxed text-ink-700">{children}</div>}
    </div>
  );
}

/* ── Kroková navigace ──────────────────────────────────────────────────── */

export function Stepper({
  steps,
  current,
  label = "Postup registrace",
  tone = "compact",
  className,
}: {
  steps: readonly string[];
  /** Index od nuly. */
  current: number;
  /** Co ten postup je — čtečka ho ohlásí místo obecného „navigace". */
  label?: string;
  /**
   * Jak výrazný má být.
   *
   * `compact` do rodičovské zóny, kde je postup podružná informace vedle
   * formuláře. `loud` do lekcí: dítě potřebuje na první pohled vidět,
   * kolik už má za sebou — to je jediná odměna, která ho drží uprostřed
   * dvacetiminutové práce.
   */
  tone?: "compact" | "loud";
  className?: string;
}) {
  const loud = tone === "loud";
  return (
    <nav aria-label={label} className={cn("w-full", className)}>
      <p className={cn("mono-label", loud ? "mb-2.5" : "mb-2")}>
        Krok {current + 1} ze {steps.length} — {steps[current]}
      </p>

      <ol className={cn("flex", loud ? "gap-2" : "gap-1.5")}>
        {steps.map((step, index) => {
          const done = index < current;
          const active = index === current;

          return (
            <li key={step} className="flex-1">
              {/* Vizuálně je to jen proužek; text vedle něj nese význam
                  pro čtečku, aby se nemusela spoléhat na barvu. */}
              <div
                aria-current={active ? "step" : undefined}
                className={cn(
                  "rounded-full transition-all duration-500",
                  loud ? "h-2.5" : "h-1.5",
                  done && "bg-trust-500",
                  active && cn("bg-primary-600", loud && "shadow-hard-sm"),
                  !done && !active && "bg-ink/15",
                )}
              />
              <span className="sr-only">
                {step}
                {done ? " — hotovo" : active ? " — právě probíhá" : " — čeká"}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── Sekce s blueprint pozadím ─────────────────────────────────────────── */

export function DarkSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("border-y border-ink bg-ink text-paper blueprint-grid-dark", className)}
    >
      {children}
    </section>
  );
}
