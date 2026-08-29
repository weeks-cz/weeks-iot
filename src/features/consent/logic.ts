import type { ConsentKind, ConsentRow } from "@/lib/supabase/types";
import { CONSENT_TEXTS, consentTextFor } from "./texts";

/**
 * Čistá logika nad ledgerem souhlasů.
 *
 * Ledger je append-only: odvolání není update, ale nový řádek s
 * granted = false. Aktuální stav je proto vždy odvozený, nikdy uložený.
 */

/** Minimum, které logika potřebuje. Testy tak nemusí stavět celý řádek. */
export type ConsentEntry = Pick<ConsentRow, "kind" | "version" | "granted" | "created_at"> & {
  id?: number;
};

/**
 * Poslední záznam daného druhu.
 *
 * Řadí se podle času a při shodě podle id. Ta druhá podmínka není zbytečná:
 * udělení a odvolání ve stejné milisekundě je vzácné, ale kdyby nastalo,
 * rozhodovalo by pořadí v poli — tedy náhoda.
 */
export function latestConsent(
  entries: readonly ConsentEntry[],
  kind: ConsentKind,
): ConsentEntry | null {
  let latest: ConsentEntry | null = null;

  for (const entry of entries) {
    if (entry.kind !== kind) continue;
    if (latest === null) {
      latest = entry;
      continue;
    }

    const a = Date.parse(entry.created_at);
    const b = Date.parse(latest.created_at);
    if (a > b || (a === b && (entry.id ?? 0) > (latest.id ?? 0))) {
      latest = entry;
    }
  }

  return latest;
}

/** Platí souhlas daného druhu? Chybějící záznam znamená ne, nikdy ano. */
export function hasConsent(entries: readonly ConsentEntry[], kind: ConsentKind): boolean {
  return latestConsent(entries, kind)?.granted ?? false;
}

/**
 * Byl souhlas udělen k aktuálnímu znění?
 *
 * Když se text změní a bumpne verze, starý souhlas dál platí pro to, co
 * člověk viděl — ale k novému znění se musí zeptat znovu.
 */
export function needsReconsent(entries: readonly ConsentEntry[], kind: ConsentKind): boolean {
  const latest = latestConsent(entries, kind);
  if (!latest || !latest.granted) return false;
  return latest.version !== consentTextFor(kind).version;
}

/** Má účet všechny povinné souhlasy platné a k aktuálnímu znění? */
export function hasAllRequiredConsents(entries: readonly ConsentEntry[]): boolean {
  return CONSENT_TEXTS.filter((t) => t.required).every(
    (t) => hasConsent(entries, t.kind) && !needsReconsent(entries, t.kind),
  );
}

/** Přehled pro obrazovku Účet → Souhlasy. */
export interface ConsentStatus {
  kind: ConsentKind;
  label: string;
  required: boolean;
  granted: boolean;
  version: string | null;
  changedAt: string | null;
  outdated: boolean;
}

export function consentStatuses(entries: readonly ConsentEntry[]): ConsentStatus[] {
  return CONSENT_TEXTS.map((text) => {
    const latest = latestConsent(entries, text.kind);
    return {
      kind: text.kind,
      label: text.label,
      required: text.required,
      granted: latest?.granted ?? false,
      version: latest?.version ?? null,
      changedAt: latest?.created_at ?? null,
      outdated: needsReconsent(entries, text.kind),
    };
  });
}
