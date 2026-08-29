import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { TARGET_MAX_AGE, TARGET_MIN_AGE } from "@/features/onboarding/schema";

/**
 * Čísla pro bránu 1.
 *
 * Čte se servisním klientem: agregáty jdou napříč všemi účty, což je přesně
 * to, co RLS běžnému uživateli zakazuje. Stránka, která tohle volá, je proto
 * chráněná seznamem adres v `METRICS_ADMIN_EMAILS`.
 *
 * Dotazy odpovídají `docs/metriky-brana-1.sql` — kdo změní jeden, musí
 * změnit i druhý. SQL soubor zůstává jako záloha pro případ, kdy se
 * dashboard nenasadí nebo je potřeba se doptat na něco, co v něm není.
 */

export type Range = "30d" | "90d" | "all";

export const RANGES: Array<{ id: Range; label: string }> = [
  { id: "30d", label: "30 dní" },
  { id: "90d", label: "90 dní" },
  { id: "all", label: "vše" },
];

function since(range: Range): string | null {
  if (range === "all") return null;
  const days = range === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

/** Cíle a hranice z plánu v2 a auditu, kap. 5.4. */
export interface GateTarget {
  /** Pod touhle hodnotou je to podle plánu neúspěch. */
  fail: number;
  /** Cíl brány k 19. 10. */
  gate: number;
}

export interface StatValue {
  value: number;
  /** Jmenovatel u poměrových metrik. */
  of?: number;
  target?: GateTarget;
}

export interface FunnelStage {
  label: string;
  value: number;
}

export interface BarItem {
  label: string;
  value: number;
  /** Doplňkový popisek vpravo (např. „ve spádu"). */
  note?: string;
}

export interface TimePoint {
  day: string;
  registrations: number;
  lessonStarts: number;
}

export interface MetricsSnapshot {
  range: Range;
  registered: StatValue;
  inTargetGroup: StatValue;
  lessonCompletion: StatValue;
  weeklyReturn: StatValue;
  funnel: FunnelStage[];
  bySource: BarItem[];
  byRegion: BarItem[];
  cityWaitlist: BarItem[];
  campClicks: BarItem[];
  timeline: TimePoint[];
  generatedAt: string;
}

export async function getMetrics(range: Range): Promise<MetricsSnapshot> {
  const service = createServiceClient();
  const from = since(range);

  /* Jeden dotaz na události a jeden na rodiče; zbytek se počítá v paměti.
     Objem je řádově tisíce řádků — dělat z toho devět round-tripů do
     databáze by bylo pomalejší než je protáhnout sem. */
  let eventsQuery = service
    .from("learning_events")
    .select("type, props, anon_id, parent_id, created_at")
    .order("created_at", { ascending: true })
    .limit(50_000);
  if (from) eventsQuery = eventsQuery.gte("created_at", from);

  let parentsQuery = service
    .from("parents")
    .select("id, region_code, utm_source, utm_campaign, onboarding_completed_at, created_at");
  if (from) parentsQuery = parentsQuery.gte("created_at", from);

  const [{ data: events }, { data: parents }, { data: regions }, { data: children }, { data: waitlist }] =
    await Promise.all([
      eventsQuery,
      parentsQuery,
      service.from("regions").select("code, name, is_camp_catchment").order("sort_order"),
      service.from("children").select("parent_id, birth_date").is("archived_at", null),
      service.from("city_waitlist").select("city, created_at"),
    ]);

  const ev = events ?? [];
  const par = parents ?? [];

  /* ── Registrovaní ───────────────────────────────────────────────────── */
  const completed = par.filter((p) => p.onboarding_completed_at);

  /* ── Cílová skupina 10–15 let ───────────────────────────────────────── */
  const ageByParent = new Map<string, number>();
  for (const c of children ?? []) {
    const born = new Date(`${c.birth_date}T00:00:00Z`);
    const now = new Date();
    let age = now.getUTCFullYear() - born.getUTCFullYear();
    const m = now.getUTCMonth() - born.getUTCMonth();
    if (m < 0 || (m === 0 && now.getUTCDate() < born.getUTCDate())) age -= 1;
    /* Nejmladší profil rozhoduje — účet se počítá do cílové skupiny,
       když v ní má aspoň jedno dítě. */
    const prev = ageByParent.get(c.parent_id);
    if (prev === undefined || age < prev) ageByParent.set(c.parent_id, age);
  }
  const inTarget = completed.filter((p) => {
    const age = ageByParent.get(p.id);
    return age !== undefined && age >= TARGET_MIN_AGE && age <= TARGET_MAX_AGE;
  });

  /* ── Hlavní metrika brány ───────────────────────────────────────────────
     Jmenovatel MUSÍ zahrnout anonymy — to je celý nález N4. Proto se
     počítá z událostí, ne z tabulky progress. */
  const actor = (e: { anon_id: string | null; parent_id: string | null }) =>
    e.anon_id ?? e.parent_id ?? "";
  const startedFirst = new Set(
    ev.filter((e) => e.type === "lesson_start" && String(e.props?.order) === "1").map(actor),
  );
  const completedFirst = new Set(
    ev.filter((e) => e.type === "lesson_complete" && String(e.props?.order) === "1").map(actor),
  );

  /* ── Trychtýř ───────────────────────────────────────────────────────── */
  const uniqueBy = (type: string) =>
    new Set(ev.filter((e) => e.type === type).map(actor)).size;

  const funnel: FunnelStage[] = [
    { label: "Návštěva", value: uniqueBy("visit_first") },
    { label: "Začal lekci", value: uniqueBy("lesson_start") },
    { label: "Dokončil lekci", value: uniqueBy("lesson_complete") },
    { label: "Viděl zeď", value: uniqueBy("signup_prompt_view") },
    { label: "Šel se registrovat", value: uniqueBy("signup_start") },
    { label: "Zaregistroval se", value: uniqueBy("signup_parent") },
  ];

  /* ── Rozpady ────────────────────────────────────────────────────────── */
  const bySource = groupCount(
    completed.map((p) => p.utm_source ?? "(přímá návštěva)"),
  );

  const regionName = new Map((regions ?? []).map((r) => [r.code, r] as const));
  const byRegion = groupCount(
    completed.map((p) => regionName.get(p.region_code ?? "")?.name ?? "(neuvedeno)"),
  ).map((b) => {
    const region = (regions ?? []).find((r) => r.name === b.label);
    return region?.is_camp_catchment ? { ...b, note: "spád" } : b;
  });

  const cityWaitlist = groupCount(
    (waitlist ?? [])
      .filter((w) => !from || w.created_at >= from)
      .map((w) => titleCase(w.city)),
  );

  const campClicks = groupCount(
    ev.filter((e) => e.type === "camp_cta_click").map((e) => String(e.props?.placement ?? "—")),
  );

  /* ── Návrat v dalším kalendářním týdnu ──────────────────────────────── */
  const weekOf = (iso: string) => {
    const d = new Date(iso);
    const day = (d.getUTCDay() + 6) % 7; // pondělí = 0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
  };
  const activityWeeks = new Map<string, Set<string>>();
  for (const e of ev) {
    if (e.type !== "lesson_start" || !e.parent_id) continue;
    const set = activityWeeks.get(e.parent_id) ?? new Set<string>();
    set.add(weekOf(e.created_at));
    activityWeeks.set(e.parent_id, set);
  }
  const returned = completed.filter((p) => {
    const next = new Date(weekOf(p.created_at));
    next.setUTCDate(next.getUTCDate() + 7);
    return activityWeeks.get(p.id)?.has(next.toISOString().slice(0, 10)) ?? false;
  });

  /* ── Časová řada ────────────────────────────────────────────────────── */
  const days = range === "30d" ? 30 : range === "90d" ? 90 : 90;
  const timeline = buildTimeline(days, completed, ev);

  return {
    range,
    registered: { value: completed.length, target: { fail: 100, gate: 40 } },
    inTargetGroup: { value: inTarget.length, of: completed.length },
    lessonCompletion: {
      value: completedFirst.size,
      of: startedFirst.size,
      target: { fail: 20, gate: 40 },
    },
    weeklyReturn: { value: returned.length, of: completed.length, target: { fail: 15, gate: 30 } },
    funnel,
    bySource,
    byRegion,
    cityWaitlist,
    campClicks,
    timeline,
    generatedAt: new Date().toISOString(),
  };
}

function groupCount(values: string[]): BarItem[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "cs"));
}

function titleCase(s: string): string {
  const t = s.trim().toLocaleLowerCase("cs");
  return t.charAt(0).toLocaleUpperCase("cs") + t.slice(1);
}

function buildTimeline(
  days: number,
  parents: Array<{ created_at: string }>,
  events: Array<{ type: string; created_at: string }>,
): TimePoint[] {
  const out: TimePoint[] = [];
  const regByDay = new Map<string, number>();
  const startByDay = new Map<string, number>();

  for (const p of parents) {
    const d = p.created_at.slice(0, 10);
    regByDay.set(d, (regByDay.get(d) ?? 0) + 1);
  }
  for (const e of events) {
    if (e.type !== "lesson_start") continue;
    const d = e.created_at.slice(0, 10);
    startByDay.set(d, (startByDay.get(d) ?? 0) + 1);
  }

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    out.push({
      day,
      registrations: regByDay.get(day) ?? 0,
      lessonStarts: startByDay.get(day) ?? 0,
    });
  }
  return out;
}
