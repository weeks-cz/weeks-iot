"use client";

import {
  ANON_SESSION_VERSION,
  ANON_STORAGE_KEY,
  anonSessionSchema,
  type AnonLesson,
  type AnonSession,
  type Attribution,
} from "./schema";

/**
 * Anonymní relace v prohlížeči.
 *
 * Do okamžiku, kdy rodič odešle registraci, je tohle jediné místo, kde
 * postup existuje. Na server neodchází nic osobního — jen události měření
 * pod náhodným anonId.
 *
 * Každý zápis i čtení je v try/catch: localStorage vyhazuje v anonymním
 * okně, při zaplněné kvótě a při zakázaných datech webu. Dítě kvůli tomu
 * nesmí přijít o lekci ani vidět rozbitou stránku.
 */

function newAnonId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function emptySession(): AnonSession {
  return {
    v: ANON_SESSION_VERSION,
    anonId: newAnonId(),
    createdAt: new Date().toISOString(),
    attribution: {},
    lessons: [],
  };
}

export function readAnonSession(): AnonSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(ANON_STORAGE_KEY);
    if (!raw) return null;

    const parsed = anonSessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      /* Poškozená nebo zastaralá relace se zahodí. Migrovat ji nemá cenu:
         je to nanejvýš pár lekcí a dítě je zopakuje rychleji, než by trvalo
         ladit migraci tvaru, který si beztak drží jen prohlížeč. */
      window.localStorage.removeItem(ANON_STORAGE_KEY);
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
}

function write(session: AnonSession): AnonSession {
  try {
    window.localStorage.setItem(ANON_STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* Plná kvóta nebo zakázaná data webu. Relace přežije aspoň v paměti
       do konce návštěvy — lepší než spadnout uprostřed lekce. */
  }
  return session;
}

/** Vrátí relaci, a když ještě neexistuje, založí ji. */
export function ensureAnonSession(): AnonSession {
  return readAnonSession() ?? write(emptySession());
}

/**
 * Zachycení UTM při první návštěvě.
 *
 * Zapisuje se jen jednou. Kdyby se přepisovalo při každém příchodu,
 * přepsal by poslední zdroj ten první a atribuce by měřila, odkud se
 * člověk vrátil, ne odkud přišel.
 */
export function captureAttribution(url: URL, referrer: string): AnonSession {
  const session = ensureAnonSession();
  if (Object.keys(session.attribution).length > 0) return session;

  const p = url.searchParams;
  const attribution: Attribution = {};

  const utm = {
    utmSource: p.get("utm_source"),
    utmMedium: p.get("utm_medium"),
    utmCampaign: p.get("utm_campaign"),
    utmContent: p.get("utm_content"),
    utmTerm: p.get("utm_term"),
  };
  for (const [key, value] of Object.entries(utm)) {
    if (value) attribution[key as keyof typeof utm] = value.slice(0, 200);
  }

  /* Odkazující stránku bereme jen zvenčí — vlastní navigace není zdroj. */
  if (referrer && !referrer.startsWith(url.origin)) {
    attribution.referrer = referrer.slice(0, 500);
  }
  attribution.landingPath = `${url.pathname}${url.search}`.slice(0, 500);

  return write({ ...session, attribution });
}

/** Zapíše začátek lekce. Opakované volání nic nezdvojí. */
export function markLessonStarted(courseSlug: string, lessonSlug: string): AnonSession {
  const session = ensureAnonSession();
  const existing = session.lessons.find(
    (l) => l.courseSlug === courseSlug && l.lessonSlug === lessonSlug,
  );
  if (existing) return session;

  const lesson: AnonLesson = {
    courseSlug,
    lessonSlug,
    startedAt: new Date().toISOString(),
  };

  return write({ ...session, lessons: [...session.lessons, lesson] });
}

/**
 * Zapíše dokončení lekce.
 *
 * První dokončení vyhrává — opakované projití téže lekce nemá posouvat čas,
 * protože metrika brány měří první dokončení.
 */
export function markLessonCompleted(
  courseSlug: string,
  lessonSlug: string,
  hintsUsed = 0,
): AnonSession {
  const session = markLessonStarted(courseSlug, lessonSlug);
  const now = new Date();

  const lessons = session.lessons.map((l) => {
    if (l.courseSlug !== courseSlug || l.lessonSlug !== lessonSlug) return l;
    if (l.completedAt) return l;

    const startedMs = Date.parse(l.startedAt);
    const durationS = Number.isFinite(startedMs)
      ? Math.max(0, Math.min(Math.round((now.getTime() - startedMs) / 1000), 86_400))
      : undefined;

    return {
      ...l,
      completedAt: now.toISOString(),
      durationS,
      hintsUsed: Math.max(0, Math.min(hintsUsed, 1000)),
    };
  });

  return write({ ...session, lessons });
}

export function hasCompletedAnyLesson(session: AnonSession | null): boolean {
  return Boolean(session?.lessons.some((l) => l.completedAt));
}

/**
 * Smazání relace.
 *
 * Volat AŽ po potvrzeném zápisu do účtu, nikdy před ním. Kdyby se mazalo
 * dopředu a zápis selhal, dítě by o postup přišlo — přesně to, co krok 6
 * z M2 slibuje, že se nestane.
 */
export function clearAnonSession(): void {
  try {
    window.localStorage.removeItem(ANON_STORAGE_KEY);
  } catch {
    /* Nedostupné úložiště nemá blokovat dokončenou registraci. */
  }
}
