import { SITE } from "@/lib/site";

export type LinkAttribution = {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
};

export const LESSON_PATH = "/kurz/iot/rozsvit-ledku/";

/**
 * Odkaz do první lekce. Původní UTM se zachová, `utm_term` říká, který e-mail
 * to byl (vždy se přepíše). Bez původního zdroje se dosadí vlastní.
 */
export function buildLessonLink(
  a: LinkAttribution,
  token: string,
  term: "odkaz-na-pc" | "pripominka-na-pc",
  origin: string = SITE.url,
): string {
  const url = new URL(LESSON_PATH, origin);
  const hasSource = Boolean(a.utmSource || a.utmMedium || a.utmCampaign);

  url.searchParams.set("utm_source", a.utmSource ?? (hasSource ? "" : "ucebna"));
  url.searchParams.set("utm_medium", a.utmMedium ?? (hasSource ? "" : "email"));
  url.searchParams.set(
    "utm_campaign",
    a.utmCampaign ?? (hasSource ? "" : "odkaz-na-pc"),
  );
  if (a.utmContent) url.searchParams.set("utm_content", a.utmContent);
  url.searchParams.set("utm_term", term);
  url.searchParams.set("odkaz", token);

  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    if (url.searchParams.get(key) === "") url.searchParams.delete(key);
  }
  return url.toString();
}

export function buildUnsubscribeLink(
  token: string,
  origin: string = SITE.url,
): string {
  const url = new URL("/odhlasit", origin);
  url.searchParams.set("t", token);
  return url.toString();
}
