import "server-only";
import { createHmac } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { rateLimit, type RateLimitName, type RateLimitResult } from "@/lib/rate-limit";
import { buildFbc, sendMetaEvent, type MetaEventInput } from "@/lib/meta-capi";
import { sendTemplate, type SendResult } from "@/lib/email/send";
import { SITE } from "@/lib/site";
import { EVENT } from "@/features/analytics/events";
import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";
import { deviceLinkEmail } from "./emails";
import { buildLessonLink, buildUnsubscribeLink } from "./link";
import { requestTokenSecret, signRequestId } from "./token";
import type { DeviceLinkInput } from "./schema";

/**
 * Logika žádosti o odkaz na počítač. Mimo `"use server"`, aby šla testovat
 * s podstrčenými závislostmi (nic z testů nesmí sáhnout na ostrou databázi
 * ani na Resend).
 */

export const DEDUPE_WINDOW_MS = 10 * 60_000;
const SOURCE_URL = `${SITE.url}/pro-rodice`;

export type NewRequestRow = {
  email: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  env: string | null;
  marketing_consent: boolean;
};

export type ConsentInsert = {
  parent_id: null;
  child_id: null;
  kind: "marketing";
  version: string;
  text_snapshot: string;
  granted: true;
  ip: string | null;
  user_agent: string | null;
  device_link_request_id: string;
};

/** Úzké rozhraní nad databází; produkčně servisní klient, v testech fake. */
export interface DeviceLinkStore {
  findRecentSent(
    email: string,
    since: Date,
  ): Promise<{ id: string; marketing_consent: boolean } | null>;
  insertRequest(row: NewRequestRow): Promise<string | null>;
  /** true = doklad je v ledgeru. */
  insertConsent(row: ConsentInsert): Promise<boolean>;
  setMarketingConsent(id: string): Promise<void>;
  markSent(id: string, at: Date): Promise<void>;
  markSendError(id: string, error: string): Promise<void>;
  insertEvent(type: string, props: Record<string, unknown>): Promise<void>;
}

export interface Deps {
  service: DeviceLinkStore;
  send: (
    to: string,
    template: ReturnType<typeof deviceLinkEmail>,
    attachments: [],
    headers: Record<string, string>,
  ) => Promise<SendResult>;
  meta: (input: MetaEventInput) => Promise<boolean>;
  limit: (name: RateLimitName, subject: string) => Promise<RateLimitResult>;
  /** Odložená práce po odpovědi (`after()` z Next); výchozí je spustit hned. */
  defer: (fn: () => Promise<unknown> | unknown) => void;
  /** Vyhodí chybu, když secret chybí. */
  secret: () => string;
}

export type DeviceLinkResult =
  | { ok: true; email: string }
  | { ok: false; error: string };

export interface DeviceLinkContext {
  ip: string | null;
  userAgent: string | null;
  fbp?: string;
  now?: Date;
  deps?: Partial<Deps>;
}

export const RATE_LIMIT_ERROR = "Zkuste to prosím za hodinu.";
export const GENERIC_ERROR = "Odeslání se nepovedlo. Zkuste to prosím za chvíli.";

export function supabaseStore(): DeviceLinkStore {
  const db = createServiceClient();
  return {
    async findRecentSent(email, since) {
      const { data } = await db
        .from("device_link_requests")
        .select("id, marketing_consent")
        .eq("email", email)
        .gte("sent_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ? { id: data.id, marketing_consent: data.marketing_consent } : null;
    },
    async insertRequest(row) {
      const { data, error } = await db
        .from("device_link_requests")
        .insert(row)
        .select("id")
        .single();
      if (error || !data) {
        console.error("[odkaz-na-pc] Zápis žádosti selhal:", error?.message);
        return null;
      }
      return data.id;
    },
    async insertConsent(row) {
      const { error } = await db.from("consents").insert(row);
      if (error) console.error("[odkaz-na-pc] Zápis souhlasu selhal:", error.message);
      return !error;
    },
    async setMarketingConsent(id) {
      const { error } = await db
        .from("device_link_requests")
        .update({ marketing_consent: true })
        .eq("id", id);
      if (error) console.error("[odkaz-na-pc] Nastavení souhlasu selhalo:", error.message);
    },
    async markSent(id, at) {
      const { error } = await db
        .from("device_link_requests")
        .update({ sent_at: at.toISOString() })
        .eq("id", id);
      if (error) console.error("[odkaz-na-pc] Zápis sent_at selhal:", error.message);
    },
    async markSendError(id, error) {
      const { error: dbError } = await db
        .from("device_link_requests")
        .update({ send_error: error })
        .eq("id", id);
      if (dbError) console.error("[odkaz-na-pc] Zápis send_error selhal:", dbError.message);
    },
    async insertEvent(type, props) {
      const { error } = await db
        .from("learning_events")
        .insert({ type, anon_id: null, parent_id: null, props });
      if (error) console.error("[odkaz-na-pc] Zápis události selhal:", error.message);
    },
  };
}

/**
 * Jedna skutečná schránka = jeden klíč: bez `+tagu`, u Gmailu navíc bez teček
 * a s googlemail.com jako gmail.com. Slouží jen pro rate limit; do řádku se
 * ukládá běžně normalizovaný e-mail.
 */
export function canonicalMailbox(email: string): string {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 0) return lower;
  let local = lower.slice(0, at);
  let domain = lower.slice(at + 1);
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

/* Do kbelíku rate limitu (tabulka v databázi) nepatří čitelný e-mail,
   ani prostý hash (šel by uhodnout slovníkem). */
export function emailKey(email: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(canonicalMailbox(email))
    .digest("hex")
    .slice(0, 32);
}

function consentRow(requestId: string, ctx: DeviceLinkContext): ConsentInsert {
  return {
    parent_id: null,
    child_id: null,
    kind: "marketing",
    version: DEVICE_LINK_MARKETING_TEXT.version,
    text_snapshot: DEVICE_LINK_MARKETING_TEXT.full,
    granted: true,
    ip: ctx.ip,
    user_agent: ctx.userAgent,
    device_link_request_id: requestId,
  };
}

export async function handleDeviceLinkRequest(
  input: DeviceLinkInput,
  ctx: DeviceLinkContext,
): Promise<DeviceLinkResult> {
  const email = input.email;

  /* 1. Honeypot: bot dostane stejné „ok" a nic se nestane. */
  if (input.hp_field_x) return { ok: true, email };

  const deps: Deps = {
    service: ctx.deps?.service ?? supabaseStore(),
    send: ctx.deps?.send ?? sendTemplate,
    meta: ctx.deps?.meta ?? sendMetaEvent,
    limit: ctx.deps?.limit ?? rateLimit,
    defer: ctx.deps?.defer ?? ((fn) => void fn()),
    secret: ctx.deps?.secret ?? requestTokenSecret,
  };
  const now = ctx.now ?? new Date();

  /* Fail-closed: bez secretu by odkaz nešlo ověřit, tak ho nevydáme.
     Čte se před rate limitem (klíč je HMAC) i před zápisem. */
  let secret: string;
  try {
    secret = deps.secret();
  } catch (err) {
    console.error("[odkaz-na-pc] Chybí secret:", err instanceof Error ? err.message : err);
    return { ok: false, error: GENERIC_ERROR };
  }

  /* 2. Rate limit: IP, pak e-mail. */
  const ipLimit = await deps.limit("deviceLinkIp", ctx.ip ?? "anonym");
  if (!ipLimit.allowed) return { ok: false, error: RATE_LIMIT_ERROR };
  const mailLimit = await deps.limit("deviceLinkEmail", emailKey(email, secret));
  if (!mailLimit.allowed) return { ok: false, error: RATE_LIMIT_ERROR };

  /* 3. Dedupe: stejný e-mail během 10 minut = další e-mail neodejde. */
  const recent = await deps.service.findRecentSent(
    email,
    new Date(now.getTime() - DEDUPE_WINDOW_MS),
  );
  if (recent) {
    if (input.marketingConsent && !recent.marketing_consent) {
      /* Příznak se nastaví jen s dokladem v ledgeru. */
      if (await deps.service.insertConsent(consentRow(recent.id, ctx))) {
        await deps.service.setMarketingConsent(recent.id);
      }
    }
    return { ok: true, email };
  }

  /* 4. Řádek žádosti. */
  const requestId = await deps.service.insertRequest({
    email,
    utm_source: input.utmSource ?? null,
    utm_medium: input.utmMedium ?? null,
    utm_campaign: input.utmCampaign ?? null,
    utm_content: input.utmContent ?? null,
    utm_term: input.utmTerm ?? null,
    referrer: input.referrer ?? null,
    env: input.env === "unknown" ? null : input.env,
    /* Příznak se zapíná až po zapsaném dokladu (krok 5). */
    marketing_consent: false,
  });
  if (!requestId) return { ok: false, error: GENERIC_ERROR };

  /* 5. Doklad souhlasu do ledgeru. */
  let consented = false;
  if (input.marketingConsent) {
    consented = await deps.service.insertConsent(consentRow(requestId, ctx));
    if (consented) await deps.service.setMarketingConsent(requestId);
  }

  /* 6. Odeslání. List-Unsubscribe jen se souhlasem (RFC 2369, v lomítkách). */
  /* Dva tokeny podle účelu: odkaz do lekce se může přeposlat, odhlášení ne. */
  const openToken = signRequestId(requestId, secret, "open");
  const unsubscribeUrl = consented
    ? buildUnsubscribeLink(signRequestId(requestId, secret, "unsub"))
    : null;
  const template = deviceLinkEmail({
    lessonUrl: buildLessonLink(
      {
        utmSource: input.utmSource,
        utmMedium: input.utmMedium,
        utmCampaign: input.utmCampaign,
        utmContent: input.utmContent,
      },
      openToken,
      "odkaz-na-pc",
    ),
    unsubscribeUrl,
  });
  const result = await deps.send(
    email,
    template,
    [],
    unsubscribeUrl ? { "List-Unsubscribe": `<${unsubscribeUrl}>` } : {},
  );

  /* 7. Výsledek odeslání. Rodiči se chyba neukazuje: žádost je uložená
        a neúspěch je vidět v `send_error`. */
  if (result.ok) await deps.service.markSent(requestId, now);
  else await deps.service.markSendError(requestId, result.error ?? "neznámá chyba");

  /* 8. CAPI Lead jen se souhlasem, stejné eventId jako Pixel v prohlížeči. */
  /* Bez eventId z prohlížeče by se Pixel a CAPI nedaly sloučit. */
  const eventId = input.eventId;
  if (consented && eventId) {
    deps.defer(() =>
      deps.meta({
        eventName: "Lead",
        eventId,
        userData: {
          email,
          fbp: ctx.fbp,
          fbc: buildFbc(input.fbclid, now),
          clientIp: ctx.ip ?? undefined,
          userAgent: ctx.userAgent ?? undefined,
        },
        eventSourceUrl: SOURCE_URL,
      }),
    );
  }

  /* 9. Událost bez e-mailu a bez anon_id. */
  await deps.service.insertEvent(EVENT.DEVICE_LINK_SUBMIT, {
    env: input.env,
    consent: consented,
  });

  return { ok: true, email };
}
