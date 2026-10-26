"use client";

import { useSyncExternalStore } from "react";
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
    window.localStorage.setItem(ANON_BUILDS_KEY, JSON.stringify([...kept, build]));
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

const noopSubscribe = () => () => {};

function readRaw(): string {
  try {
    return window.localStorage.getItem(ANON_BUILDS_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Surový obsah klíče pro skryté pole formuláře (prázdný na serveru). */
export function useAnonBuildsRaw(): string {
  return useSyncExternalStore(noopSubscribe, readRaw, () => "");
}
