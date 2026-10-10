/**
 * Rozpracovaný onboarding v sessionStorage.
 *
 * Obnovení stránky (nebo zavřený a znovu otevřený tab) nesmí smazat, co
 * rodič vyplnil. Ukládá se jen to, co není souhlas: datum, přezdívka, avatar
 * a kraj. Souhlasy se NIKDY neukládají — předvyplněný souhlas by nebyl
 * souhlas, a navíc by se po obnovení tvářil jako čerstvě udělený.
 *
 * sessionStorage, ne localStorage: rozdělaný formulář patří tomu jednomu
 * oknu. Na sdíleném počítači ho další člověk v novém okně neuvidí.
 *
 * Obsah se čte jako nedůvěryhodný vstup a každé pole se ověří zvlášť;
 * poškozený záznam se tiše zahodí.
 */

export const ONBOARDING_DRAFT_KEY = "ucebna.onboarding.draft.v1";

export interface OnboardingDraft {
  birthDate: string;
  nick: string;
  avatar: string;
  region: string;
}

export const EMPTY_DRAFT: OnboardingDraft = {
  birthDate: "",
  nick: "",
  avatar: "robot",
  region: "",
};

const BIRTH_DATE = /^\d{4}-\d{2}-\d{2}$/;
const AVATAR = /^[a-z0-9-]{1,40}$/;
const REGION = /^[A-Z0-9-]{1,10}$/;

/** Rozbor uloženého záznamu. Cokoli nečekaného → null (zahodí se celé). */
export function parseDraft(raw: string | null | undefined): OnboardingDraft | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2_000) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const v = value as Record<string, unknown>;
  const { birthDate, nick, avatar, region } = v;

  if (typeof birthDate !== "string" || (birthDate !== "" && !BIRTH_DATE.test(birthDate))) return null;
  if (typeof nick !== "string" || nick.length > 24) return null;
  if (typeof avatar !== "string" || !AVATAR.test(avatar)) return null;
  if (typeof region !== "string" || (region !== "" && !REGION.test(region))) return null;

  return { birthDate, nick, avatar, region };
}

/** Jen čtyři pole, žádné souhlasy — ani kdyby je volající předal. */
export function serializeDraft(draft: OnboardingDraft): string {
  return JSON.stringify({
    birthDate: draft.birthDate,
    nick: draft.nick,
    avatar: draft.avatar,
    region: draft.region,
  });
}

/* ── Úložiště (jen v prohlížeči) ─────────────────────────────────────── */

export function readDraft(): OnboardingDraft | null {
  if (typeof window === "undefined") return null;
  try {
    return parseDraft(window.sessionStorage.getItem(ONBOARDING_DRAFT_KEY));
  } catch {
    return null;
  }
}

export function writeDraft(draft: OnboardingDraft): void {
  try {
    window.sessionStorage.setItem(ONBOARDING_DRAFT_KEY, serializeDraft(draft));
  } catch {
    /* Plné nebo zakázané úložiště nesmí rozbít formulář. */
  }
}

/** Volá se AŽ po úspěšném odeslání (stránka /ucet?vitejte=1), ne dřív. */
export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(ONBOARDING_DRAFT_KEY);
  } catch {
    /* Nic k úklidu. */
  }
}
