import "server-only";
import { createHash } from "node:crypto";

/**
 * Meta Conversions API — serverové měření konverzí.
 *
 * Portováno z weeks_web (`src/lib/meta-capi.ts`), kde běží v produkci.
 * Upraveno pro učebnu: hlavní konverzí je tu **registrace**, ne nákup,
 * takže výchozí událost je `CompleteRegistration`.
 *
 * ── Proč to vůbec existuje ─────────────────────────────────────────────────
 * Pixel v prohlížeči vystřelí jen tehdy, když návštěvník přijme cookies
 * A vrátí se na naši stránku ve sledovaném prohlížeči. iOS, blokovače
 * reklam a odmítnutý souhlas jsou pro něj neviditelné. Vyhladovělý signál
 * znamená, že se optimalizátor Meta nikdy nenaučí, kdo se doopravdy
 * registruje — a bez toho se nedá spočítat cena za registraci, tedy číslo,
 * na kterém stojí celá brána 1.
 *
 * Server o registraci ví vždycky, protože ji sám zapisuje.
 *
 * ── Deduplikace ────────────────────────────────────────────────────────────
 * Každá serverová událost nese `eventId`. Odpovídající událost z prohlížeče
 * posílá totéž přes `fbq(..., { eventID })`. Meta pár sloučí, takže se
 * konverze počítá jednou bez ohledu na to, jestli dorazí jedna nebo obě.
 *
 * ── Nikdy nevyhazuje ───────────────────────────────────────────────────────
 * Selhání se zaloguje, ale nesmí shodit dokončení onboardingu. Měření je
 * důležité; registrace důležitější.
 */

const GRAPH_VERSION = "v21.0";

function pixelId(): string | undefined {
  return process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim();
}

function accessToken(): string | undefined {
  return process.env.META_CAPI_ACCESS_TOKEN?.trim();
}

export function isMetaCapiConfigured(): boolean {
  return Boolean(pixelId() && accessToken());
}

/* ── Normalizace a hashování ────────────────────────────────────────────────
   Identifikátory se podle specifikace Meta ořežou, převedou na malá písmena
   a zahashují SHA-256. Výjimkou jsou fbp/fbc, IP a user agent — ty se párují
   syrové a hashovat se NESMÍ. */

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeEmail(email?: string): string | undefined {
  const norm = email?.trim().toLowerCase();
  return norm || undefined;
}

function hashEmail(email?: string): string | undefined {
  const norm = normalizeEmail(email);
  return norm ? sha256(norm) : undefined;
}

export interface MetaUserData {
  email?: string;
  /** Hodnota cookie _fbp — syrová, nehashovaná. */
  fbp?: string;
  /** Hodnota cookie _fbc, případně sestavená z fbclid — syrová. */
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
}

function buildUserData(u: MetaUserData): Record<string, string> {
  const out: Record<string, string> = {};

  const em = hashEmail(u.email);
  if (em) out.em = em;

  /* Země je pro naše publikum konstantní. Podle specifikace se posílá
     zahashovaný dvoupísmenný kód. */
  out.country = sha256("cz");

  if (u.fbp) out.fbp = u.fbp;
  if (u.fbc) out.fbc = u.fbc;
  if (u.clientIp) out.client_ip_address = u.clientIp;
  if (u.userAgent) out.client_user_agent = u.userAgent;

  return out;
}

export type MetaEventName =
  | "CompleteRegistration"
  | "Lead"
  | "StartTrial"
  | "InitiateCheckout"
  | "Purchase";

export interface MetaEventInput {
  eventName: MetaEventName;
  /** Sdílené s událostí z prohlížeče kvůli deduplikaci. */
  eventId: string;
  userData: MetaUserData;
  customData?: {
    value?: number;
    currency?: string;
    contentName?: string;
  };
  eventSourceUrl?: string;
}

/**
 * Odešle jednu serverovou událost do Meta.
 *
 * Vrací true při 2xx, jinak false — i když CAPI není nakonfigurované.
 * Nikdy nevyhazuje výjimku.
 */
export async function sendMetaEvent(input: MetaEventInput): Promise<boolean> {
  const id = pixelId();
  const token = accessToken();
  if (!id || !token) return false; // Nenakonfigurováno — tiše nic.

  const custom: Record<string, unknown> = {};
  if (input.customData?.value != null) custom.value = input.customData.value;
  if (input.customData?.currency) custom.currency = input.customData.currency;
  if (input.customData?.contentName) custom.content_name = input.customData.contentName;

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        ...(input.eventSourceUrl ? { event_source_url: input.eventSourceUrl } : {}),
        user_data: buildUserData(input.userData),
        ...(Object.keys(custom).length ? { custom_data: custom } : {}),
      },
    ],
  };

  const testCode = process.env.META_TEST_EVENT_CODE?.trim();
  if (testCode) payload.test_event_code = testCode;

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${id}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        /* Pomalá Graph API nesmí zdržet dokončení registrace. */
        signal: AbortSignal.timeout(3000),
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[meta-capi] Událost odmítnuta:", {
        eventName: input.eventName,
        eventId: input.eventId,
        httpStatus: res.status,
        /* Osobní údaje jsou v těle zahashované, odpověď je bezpečné logovat. */
        detail: detail.slice(0, 500),
      });
      return false;
    }

    return true;
  } catch (e) {
    console.error("[meta-capi] Odeslání selhalo:", {
      eventName: input.eventName,
      eventId: input.eventId,
      error: e instanceof Error ? e.message : String(e),
    });
    return false;
  }
}

/**
 * Sestavení `_fbc` z parametru `fbclid`.
 *
 * Když člověk přijde z reklamy poprvé, cookie `_fbc` ještě neexistuje —
 * Pixel ji teprve vytvoří. Server ji ale umí složit sám podle formátu
 * `fb.1.<čas>.<fbclid>`, a právě u první návštěvy z reklamy je párování
 * nejcennější.
 */
export function buildFbc(fbclid: string | null | undefined, now: Date = new Date()): string | undefined {
  if (!fbclid) return undefined;
  return `fb.1.${now.getTime()}.${fbclid}`;
}
