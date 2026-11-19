import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTemplate, type SendResult } from "@/lib/email/send";
import type { DeviceLinkRequestRow } from "@/lib/supabase/types";
import { deviceLinkReminderEmail } from "./emails";
import { buildLessonLink, buildUnsubscribeLink } from "./link";
import { requestTokenSecret, signRequestId } from "./token";

/**
 * Denní práce nad `device_link_requests`: jedna připomínka a anonymizace.
 * Volá ji cron sekvence PŘED dotazem na rodiče. Logika je mimo route, aby šla
 * testovat s podstrčeným úložištěm (lokální prostředí míří na ostrou databázi).
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const REMINDER_MIN_AGE_MS = 48 * HOUR;
export const REMINDER_MAX_AGE_MS = 7 * DAY;
export const ANONYMIZE_AFTER_MS = 90 * DAY;
/** Kolik řádků nejvýš za běh a druh práce. Chrání limit Resendu i dobu běhu. */
export const JOBS_BATCH = 100;

/** `rodic@example.com` → `ro***@example.com`. Účet se pozná, adresa neunikne. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at < 1) return "***";
  return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

function needsAnonymizing(r: DeviceLinkRequestRow, now: number): boolean {
  if (r.anonymized_at) return false;
  if (now - new Date(r.created_at).getTime() <= ANONYMIZE_AFTER_MS) return false;
  /* Platný souhlas řádek drží. Bez něj (nedán, nebo odvolán) se maže. */
  return !r.marketing_consent || r.unsubscribed_at !== null;
}

function needsReminder(
  r: DeviceLinkRequestRow,
  registered: ReadonlySet<string>,
  now: number,
): boolean {
  if (!r.marketing_consent || !r.email) return false;
  if (!r.sent_at || r.opened_at || r.reminder_sent_at) return false;
  if (r.unsubscribed_at || r.anonymized_at) return false;
  const age = now - new Date(r.created_at).getTime();
  if (age < REMINDER_MIN_AGE_MS || age > REMINDER_MAX_AGE_MS) return false;
  return !registered.has(r.email.toLowerCase());
}

/** Stav, po kterém už adresa žádnou připomínku nedostane, ať je u které žádosti. */
function blocksAddress(r: DeviceLinkRequestRow): boolean {
  return Boolean(r.opened_at || r.reminder_sent_at || r.unsubscribed_at);
}

/**
 * Čistá funkce: vrací id řádků. `registeredEmails` jsou malými písmeny.
 *
 * `siblings` jsou ostatní žádosti na adresy kandidátů, bez filtru stavu a
 * stáří (předvýběr kandidátů vyřazuje právě ty řádky, které připomínku
 * blokují). Připomínka je jedna na ADRESU, ne na žádost: rodič, který si
 * odkaz nechal poslat dvakrát, dostane nejvýš jednu, a to k novější žádosti.
 * Adresu, u které už některá žádost byla otevřená na počítači, připomenutá
 * nebo odhlášená, přeskočí celou.
 */
export function planDeviceLinkJobs(
  rows: DeviceLinkRequestRow[],
  registeredEmails: ReadonlySet<string>,
  now: Date,
  siblings: DeviceLinkRequestRow[] = [],
): { remind: string[]; anonymize: string[] } {
  const t = now.getTime();

  const blocked = new Set<string>();
  for (const r of [...rows, ...siblings]) {
    if (r.email && blocksAddress(r)) blocked.add(r.email.toLowerCase());
  }

  const newestByEmail = new Map<string, DeviceLinkRequestRow>();
  for (const r of rows) {
    if (!needsReminder(r, registeredEmails, t)) continue;
    const key = r.email!.toLowerCase();
    if (blocked.has(key)) continue;
    const current = newestByEmail.get(key);
    if (!current || new Date(r.created_at).getTime() > new Date(current.created_at).getTime()) {
      newestByEmail.set(key, r);
    }
  }

  return {
    remind: [...newestByEmail.values()].map((r) => r.id),
    anonymize: rows.filter((r) => needsAnonymizing(r, t)).map((r) => r.id),
  };
}

export interface JobsStore {
  /** Předvýběr pro plán (rozhoduje ale `planDeviceLinkJobs`). Chyba se HAZÍ. */
  listCandidates(now: Date): Promise<DeviceLinkRequestRow[]>;
  /** Které z e-mailů mají účet v `parents` (vrací malými písmeny). */
  registeredEmails(emails: string[]): Promise<Set<string>>;
  /** Všechny žádosti na tyto adresy (citext), bez filtru stavu a stáří. Chyba se HAZÍ. */
  siblingsByEmail(emails: string[]): Promise<DeviceLinkRequestRow[]>;
  /**
   * `reminder_sent_at = at` jen pro řádek, který připomínku pořád smí dostat
   * (souhlas, neotevřený, neodhlášený, neanonymizovaný, nepřipomenutý).
   * Stav se mohl změnit mezi plánem a odesláním. true = nárok získán.
   */
  claimReminder(id: string, at: Date): Promise<boolean>;
  /** `email = null, send_error = null, anonymized_at = at`. true = zapsáno. */
  anonymize(id: string, at: Date): Promise<boolean>;
}

export interface JobsDeps {
  store: JobsStore;
  send: (
    to: string,
    template: ReturnType<typeof deviceLinkReminderEmail>,
    attachments: [],
    headers: Record<string, string>,
  ) => Promise<SendResult>;
  secret: () => string;
}

export type JobsResult = {
  reminded: number;
  anonymized: number;
  failed: number;
  plan: Array<{ email: string; job: string }>;
};

export function supabaseJobsStore(): JobsStore {
  const db = createServiceClient();
  const COLUMNS =
    "id, email, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, env, marketing_consent, sent_at, send_error, verified_at, opened_at, reminder_sent_at, unsubscribed_at, anonymized_at, created_at";
  return {
    async listCandidates(now) {
      const iso = (ms: number) => new Date(now.getTime() - ms).toISOString();
      /* Dva úzké dotazy místo jednoho širokého: staré řádky se souhlasem se
         nikdy nemažou a časem by zaplnily limit. */
      const [reminders, stale] = await Promise.all([
        db
          .from("device_link_requests")
          .select(COLUMNS)
          .eq("marketing_consent", true)
          .not("sent_at", "is", null)
          .not("email", "is", null)
          .is("opened_at", null)
          .is("reminder_sent_at", null)
          .is("unsubscribed_at", null)
          .is("anonymized_at", null)
          .gte("created_at", iso(REMINDER_MAX_AGE_MS))
          .lte("created_at", iso(REMINDER_MIN_AGE_MS))
          .order("created_at", { ascending: true })
          .limit(JOBS_BATCH),
        db
          .from("device_link_requests")
          .select(COLUMNS)
          .is("anonymized_at", null)
          .lt("created_at", iso(ANONYMIZE_AFTER_MS))
          .or("marketing_consent.eq.false,unsubscribed_at.not.is.null")
          .order("created_at", { ascending: true })
          .limit(JOBS_BATCH),
      ]);
      if (reminders.error) throw new Error(reminders.error.message);
      if (stale.error) throw new Error(stale.error.message);
      return [...(reminders.data ?? []), ...(stale.data ?? [])];
    },
    async registeredEmails(emails) {
      if (emails.length === 0) return new Set();
      const { data, error } = await db.from("parents").select("email").in("email", emails);
      if (error) throw new Error(error.message);
      return new Set((data ?? []).map((p) => p.email.toLowerCase()));
    },
    async siblingsByEmail(emails) {
      if (emails.length === 0) return [];
      const { data, error } = await db
        .from("device_link_requests")
        .select(COLUMNS)
        .in("email", emails);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    async claimReminder(id, at) {
      const { data, error } = await db
        .from("device_link_requests")
        .update({ reminder_sent_at: at.toISOString() })
        .eq("id", id)
        .is("reminder_sent_at", null)
        .eq("marketing_consent", true)
        .is("unsubscribed_at", null)
        .is("opened_at", null)
        .is("anonymized_at", null)
        .select("id");
      if (error) {
        console.error("[odkaz-na-pc] Nárok na připomínku selhal:", error.message);
        return false;
      }
      return (data ?? []).length > 0;
    },
    async anonymize(id, at) {
      const { error } = await db
        .from("device_link_requests")
        /* `send_error` může obsahovat adresu (hláška Resendu), maže se s ní. */
        .update({ email: null, send_error: null, anonymized_at: at.toISOString() })
        .eq("id", id)
        .is("anonymized_at", null);
      if (error) console.error("[odkaz-na-pc] Anonymizace selhala:", error.message);
      return !error;
    },
  };
}

export async function runDeviceLinkJobs(
  opts: { dryRun: boolean; now?: Date },
  deps: Partial<JobsDeps> = {},
): Promise<JobsResult> {
  const store = deps.store ?? supabaseJobsStore();
  const send = deps.send ?? sendTemplate;
  const now = opts.now ?? new Date();
  const result: JobsResult = { reminded: 0, anonymized: 0, failed: 0, plan: [] };

  const rows = await store.listCandidates(now);
  const emails = [
    ...new Set(
      rows.filter((r) => r.email).flatMap((r) => [r.email!, r.email!.toLowerCase()]),
    ),
  ];
  const [registered, siblings] = emails.length
    ? await Promise.all([store.registeredEmails(emails), store.siblingsByEmail(emails)])
    : [new Set<string>(), []];
  const { remind, anonymize } = planDeviceLinkJobs(rows, registered, now, siblings);
  const byId = new Map(rows.map((r) => [r.id, r]));

  /* Anonymizace první: řádek, který se maže, připomínku nedostane. */
  for (const id of anonymize.slice(0, JOBS_BATCH)) {
    const r = byId.get(id)!;
    if (opts.dryRun) {
      result.plan.push({ email: r.email ? maskEmail(r.email) : "(bez e-mailu)", job: "anonymizace" });
      result.anonymized += 1;
      continue;
    }
    if (await store.anonymize(id, now)) result.anonymized += 1;
    else result.failed += 1;
  }

  /* Tajemství se čte jen, když je co posílat; chybějící secret = chyba celé práce. */
  const secret = remind.length && !opts.dryRun ? (deps.secret ?? requestTokenSecret)() : "";

  for (const id of remind.slice(0, JOBS_BATCH)) {
    const r = byId.get(id)!;
    const email = r.email!;
    if (opts.dryRun) {
      result.plan.push({ email: maskEmail(email), job: "připomínka" });
      result.reminded += 1;
      continue;
    }

    /* Nárok PŘED odesláním (stejně jako v cronu sekvence): odeslaný e-mail
       nejde vzít zpět, zápis ano. Selhané odeslání se neopakuje. */
    if (!(await store.claimReminder(id, now))) continue;

    const unsubscribeUrl = buildUnsubscribeLink(signRequestId(id, secret, "unsub"));
    const template = deviceLinkReminderEmail({
      lessonUrl: buildLessonLink(
        {
          utmSource: r.utm_source ?? undefined,
          utmMedium: r.utm_medium ?? undefined,
          utmCampaign: r.utm_campaign ?? undefined,
          utmContent: r.utm_content ?? undefined,
        },
        signRequestId(id, secret, "open"),
        "pripominka-na-pc",
      ),
      unsubscribeUrl,
    });
    const sent = await send(email, template, [], {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
    });
    if (sent.ok) result.reminded += 1;
    else {
      result.failed += 1;
      /* Bez e-mailu v logu: jen id řádku. */
      console.error("[odkaz-na-pc] Připomínka se neodeslala:", id, sent.error ?? "");
    }
  }

  return result;
}

/** Obal pro cron: chyba (třeba chybějící tabulka před migrací) se nevyhazuje. */
export async function safeRunDeviceLinkJobs(
  opts: { dryRun: boolean; now?: Date },
  deps: Partial<JobsDeps> = {},
): Promise<JobsResult | { error: string }> {
  try {
    return await runDeviceLinkJobs(opts, deps);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/email-sequence] Odkaz na PC selhal:", message);
    return { error: message };
  }
}
