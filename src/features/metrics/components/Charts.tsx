import { cn } from "@/lib/cn";
import type { BarItem, FunnelStage, StatValue, TimePoint } from "../queries";

/**
 * Vizuály dashboardu.
 *
 * Bez knihovny na grafy: dat jsou desítky řádků, takže je levnější je
 * vykreslit jako HTML a inline SVG než přitáhnout balík, který stejně
 * neumí česky formátovat čísla.
 *
 * Pravidla, kterých se to drží:
 *  • Jedna barva na jednu řadu. Odstín podle velikosti sloupce by kódoval
 *    hodnotu dvakrát — délka to už říká — a spálil by jediný volný kanál.
 *  • Každý sloupec má popisek s číslem. Hodnota nikdy nesmí být dostupná
 *    jen přes najetí myší.
 *  • Mřížka a osy jsou vlasové a o odstín od podkladu, ne přes celý graf.
 *  • Stavové barvy (splněno / pod hranicí) se nepoužívají na řady a vždy
 *    je doprovází text — nikdy nerozhoduje jen barva.
 */

const cs = new Intl.NumberFormat("cs-CZ");

/* ── Stat tile ────────────────────────────────────────────────────────────
   Jedno číslo je jedno číslo. Sloupcový graf o jednom sloupci je
   nejčastější způsob, jak graf mine svůj smysl. */

type Verdict = "gate" | "close" | "fail" | "none";

function verdictOf(pct: number | null, target?: { fail: number; gate: number }): Verdict {
  if (pct === null || !target) return "none";
  if (pct >= target.gate) return "gate";
  if (pct >= target.fail) return "close";
  return "fail";
}

const VERDICT_STYLE: Record<Verdict, { chip: string; bar: string; label: string }> = {
  gate: { chip: "border-trust-600 text-trust-800 bg-trust-50", bar: "bg-trust-500", label: "brána splněna" },
  close: { chip: "border-cta-600 text-cta-900 bg-cta-50", bar: "bg-cta-500", label: "pod cílem brány" },
  fail: { chip: "border-danger-500 text-danger-700 bg-danger-50", bar: "bg-danger-500", label: "pásmo neúspěchu" },
  none: { chip: "border-ink/25 text-ink-500 bg-white", bar: "bg-primary-600", label: "" },
};

export function StatTile({
  label,
  stat,
  unit,
  hint,
}: {
  label: string;
  stat: StatValue;
  /** „%" u poměrových metrik, jinak nic. */
  unit?: string;
  hint?: string;
}) {
  const isRatio = stat.of !== undefined;
  const pct = isRatio && stat.of ? (stat.value / stat.of) * 100 : null;

  /* U absolutního počtu se cíl porovnává přímo s hodnotou, u poměru
     s procenty. Míchat to by dalo nesmysl typu „40 registrovaných = 40 %". */
  const compareValue = isRatio ? pct : stat.value;
  const verdict = verdictOf(compareValue, stat.target);
  const style = VERDICT_STYLE[verdict];

  const shown = isRatio ? (pct === null ? "—" : `${pct.toFixed(0)}`) : cs.format(stat.value);
  const progress = stat.target
    ? Math.min(100, ((compareValue ?? 0) / stat.target.gate) * 100)
    : null;

  return (
    <div className="card-maker p-5">
      <p className="mono-label mb-3">{label}</p>

      <p className="flex items-baseline gap-1">
        {/* Proporcionální číslice: tabular-nums dělá velké číslo rozvolněné.
            Zarovnávat se tu nemá s čím. */}
        <span className="font-display text-4xl font-bold leading-none text-ink">{shown}</span>
        {unit && <span className="font-display text-xl font-semibold text-ink-300">{unit}</span>}
      </p>

      {isRatio && stat.of !== undefined && (
        <p className="mt-1 font-mono text-xs text-ink-500">
          {cs.format(stat.value)} z {cs.format(stat.of)}
        </p>
      )}

      {progress !== null && (
        <div className="mt-4">
          <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div
              className={cn("h-full rounded-full transition-all", style.bar)}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="font-mono text-[0.6875rem] text-ink-300">
              cíl {stat.target!.gate}
              {unit ?? ""}
            </span>
            {/* Verdikt nese text, ne jen barva. */}
            <span
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-mono text-[0.6875rem]",
                style.chip,
              )}
            >
              {style.label}
            </span>
          </div>
        </div>
      )}

      {hint && <p className="mt-3 text-xs leading-relaxed text-ink-500">{hint}</p>}
    </div>
  );
}

/* ── Trychtýř ─────────────────────────────────────────────────────────── */

export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">
        Trychtýř registrace — počet lidí v každém kroku
      </caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Krok</th>
          <th scope="col">Lidí</th>
          <th scope="col">Propad</th>
        </tr>
      </thead>
      <tbody>
        {stages.map((stage, i) => {
          const prev = i > 0 ? stages[i - 1]!.value : null;
          const drop = prev && prev > 0 ? ((prev - stage.value) / prev) * 100 : null;

          return (
            <tr key={stage.label}>
              <th scope="row" className="w-40 py-2 pr-3 text-left text-sm font-medium text-ink">
                {stage.label}
              </th>
              <td className="py-2">
                <div className="flex items-center gap-3">
                  <div
                    className="h-5 rounded-r-sm bg-primary-600"
                    style={{ width: `${Math.max((stage.value / max) * 100, stage.value > 0 ? 2 : 0)}%` }}
                  />
                  {/* Popisek vždy vedle sloupce, ne uvnitř — v krátkém
                      sloupci by se ořízl. */}
                  <span className="font-mono text-sm tabular-nums text-ink">
                    {cs.format(stage.value)}
                  </span>
                </div>
              </td>
              <td className="w-24 py-2 pl-2 text-right font-mono text-xs tabular-nums text-ink-300">
                {drop !== null && drop > 0 ? `−${drop.toFixed(0)} %` : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ── Vodorovné sloupce ────────────────────────────────────────────────── */

export function BarList({
  items,
  caption,
  emptyText = "zatím žádná data",
  max: maxItems = 10,
}: {
  items: BarItem[];
  caption: string;
  emptyText?: string;
  max?: number;
}) {
  if (items.length === 0) {
    return <p className="py-4 font-mono text-xs text-ink-300">{emptyText}</p>;
  }

  const shown = items.slice(0, maxItems);
  const rest = items.slice(maxItems);
  const restTotal = rest.reduce((sum, i) => sum + i.value, 0);
  const rows = restTotal > 0 ? [...shown, { label: "Ostatní", value: restTotal }] : shown;
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Položka</th>
          <th scope="col">Počet</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((item) => (
          <tr key={item.label}>
            <th scope="row" className="w-44 py-1.5 pr-3 text-left text-sm font-normal text-ink-700">
              <span className="block truncate" title={item.label}>
                {item.label}
              </span>
            </th>
            <td className="py-1.5">
              <div className="flex items-center gap-3">
                <div
                  className="h-4 rounded-r-sm bg-primary-600"
                  style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }}
                />
                <span className="font-mono text-sm tabular-nums text-ink">
                  {cs.format(item.value)}
                </span>
                {item.note && (
                  <span className="rounded-sm border border-trust-600 bg-trust-50 px-1.5 py-0.5 font-mono text-[0.625rem] text-trust-800">
                    {item.note}
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Časová řada ──────────────────────────────────────────────────────── */

export function Timeline({ points }: { points: TimePoint[] }) {
  const total = points.reduce((s, p) => s + p.registrations, 0);
  if (total === 0 && points.every((p) => p.lessonStarts === 0)) {
    return (
      <p className="py-8 text-center font-mono text-xs text-ink-300">
        zatím žádná data — čísla se objeví, jakmile začnou chodit návštěvy
      </p>
    );
  }

  const W = 720;
  const H = 160;
  const PAD = { top: 8, right: 8, bottom: 22, left: 28 };
  const max = Math.max(...points.flatMap((p) => [p.registrations, p.lessonStarts]), 1);

  const x = (i: number) =>
    PAD.left + (i / Math.max(points.length - 1, 1)) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);

  const path = (key: "registrations" | "lessonStarts") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  const labelEvery = Math.ceil(points.length / 6);

  return (
    <div>
      {/* Legenda je u dvou řad povinná — identita nesmí stát jen na barvě. */}
      <div className="mb-3 flex flex-wrap gap-4">
        {[
          { color: "bg-primary-600", label: "Registrace" },
          { color: "bg-accent-500", label: "Začaté lekce" },
        ].map((s) => (
          <span key={s.label} className="flex items-center gap-2 text-xs text-ink-500">
            <span className={cn("h-0.5 w-4 rounded-full", s.color)} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Vývoj registrací a začatých lekcí za posledních ${points.length} dní`}
      >
        {/* Vlasová mřížka o odstín od podkladu, plná čára — čárkovaná by
            se četla jako prognóza nebo mez. */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="currentColor"
              strokeWidth={1}
              className="text-ink/10"
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              className="fill-ink-300 font-mono text-[9px] tabular-nums"
            >
              {t}
            </text>
          </g>
        ))}

        <path d={path("lessonStarts")} fill="none" strokeWidth={2} className="stroke-accent-500" />
        <path d={path("registrations")} fill="none" strokeWidth={2} className="stroke-primary-600" />

        {points.map((p, i) =>
          i % labelEvery === 0 ? (
            <text
              key={p.day}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-ink-300 font-mono text-[9px]"
            >
              {p.day.slice(8)}.{p.day.slice(5, 7)}.
            </text>
          ) : null,
        )}
      </svg>

      {/* Tabulková podoba téhož. Hodnota nikdy nesmí být dostupná jen
          z obrázku. */}
      <details className="mt-3">
        <summary className="cursor-pointer font-mono text-xs text-primary-600">
          Zobrazit jako tabulku
        </summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-ink/15 text-left">
                <th className="py-1.5 font-mono text-xs font-medium text-ink-500">Den</th>
                <th className="py-1.5 text-right font-mono text-xs font-medium text-ink-500">
                  Registrace
                </th>
                <th className="py-1.5 text-right font-mono text-xs font-medium text-ink-500">
                  Začaté lekce
                </th>
              </tr>
            </thead>
            <tbody>
              {points
                .filter((p) => p.registrations > 0 || p.lessonStarts > 0)
                .map((p) => (
                  <tr key={p.day} className="border-b border-ink/5">
                    <td className="py-1 font-mono text-xs tabular-nums">{p.day}</td>
                    <td className="py-1 text-right font-mono text-xs tabular-nums">
                      {p.registrations}
                    </td>
                    <td className="py-1 text-right font-mono text-xs tabular-nums">
                      {p.lessonStarts}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
