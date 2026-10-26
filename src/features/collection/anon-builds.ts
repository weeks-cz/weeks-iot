"use client";

import { useSyncExternalStore } from "react";
import { ANON_BUILDS_CLIENT_BUDGET, MAX_ANON_BUILDS } from "./parse-builds";
import { lessonBuildSchema, type LessonBuild } from "./schema";

/**
 * Výtvory dítěte bez účtu.
 *
 * Vlastní klíč v localStorage, ne součást anonymní relace: schéma relace
 * zůstává ve verzi 1 a výtvory (stovky kB) by ji nafoukly nad strop, který
 * server při převzetí přijímá. Stejně jako u relace je každý přístup
 * k úložišti v try/catch — dítě kvůli plné kvótě nesmí přijít o lekci.
 */

export const ANON_BUILDS_KEY = "ucebna.anon-builds.v1";

function readList(): unknown[] {
  try {
    const raw = window.localStorage.getItem(ANON_BUILDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Platné výtvory; poškozené položky se zahodí, ostatní zůstanou. */
export function readAnonBuilds(): LessonBuild[] {
  if (typeof window === "undefined") return [];
  const out: LessonBuild[] = [];
  for (const item of readList()) {
    const parsed = lessonBuildSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

/**
 * Uloží výtvor; na lekci je jeden, nový přepíše starý.
 * Vrací, jestli se uložil — plná kvóta nebo zakázaná data webu = `false`
 * (odchylka od původního `void`, volající podle toho ukáže správnou hlášku).
 */
export function saveAnonBuild(build: LessonBuild): boolean {
  if (typeof window === "undefined") return false;
  try {
    const kept = readAnonBuilds().filter(
      (b) => !(b.courseSlug === build.courseSlug && b.lessonSlug === build.lessonSlug),
    );
    /* Nejnovější je vždy poslední; nad strop se vyřazují nejstarší, ať
       formulář nikdy nepošle víc, než server přijme. */
    const next = [...kept, build].slice(-MAX_ANON_BUILDS);
    window.localStorage.setItem(ANON_BUILDS_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

/** Volat až po potvrzeném převzetí do účtu, stejně jako `clearAnonSession`. */
export function clearAnonBuilds(): void {
  try {
    window.localStorage.removeItem(ANON_BUILDS_KEY);
  } catch {
    /* Nedostupné úložiště nemá blokovat dokončenou registraci. */
  }
}

/**
 * Řetězec pro skryté pole formuláře: nejnovější výtvory, které se vejdou
 * do rozpočtu znaků. Server action má limit těla 1 MB; kdyby výtvory
 * přerostly, neprošla by registrace ani převzetí.
 */
export function serializeBuildsForForm(
  builds: LessonBuild[],
  budget = ANON_BUILDS_CLIENT_BUDGET,
): string {
  const picked: string[] = [];
  let total = 2; // hranaté závorky
  for (let i = builds.length - 1; i >= 0; i--) {
    const json = JSON.stringify(builds[i]);
    if (total + json.length + 1 > budget) continue;
    picked.unshift(json);
    total += json.length + 1;
  }
  return picked.length === 0 ? "" : `[${picked.join(",")}]`;
}

const noopSubscribe = () => () => {};

/* Snapshot musí být stabilní řetězec a validace je drahá, proto se výsledek
   pamatuje podle surového obsahu klíče. */
let cached: { raw: string; value: string } | null = null;

function readRaw(): string {
  try {
    const raw = window.localStorage.getItem(ANON_BUILDS_KEY) ?? "";
    if (!raw) return "";
    if (cached?.raw === raw) return cached.value;
    const value = serializeBuildsForForm(readAnonBuilds());
    cached = { raw, value };
    return value;
  } catch {
    return "";
  }
}

/** Obsah pole `anonBuilds` formuláře (prázdný na serveru). */
export function useAnonBuildsRaw(): string {
  return useSyncExternalStore(noopSubscribe, readRaw, () => "");
}
