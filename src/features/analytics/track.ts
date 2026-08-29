"use client";

import { createClient } from "@/lib/supabase/client";
import { ensureAnonSession } from "@/features/anon-session/storage";
import { EVENT, isServerOnlyEvent, type EventName } from "./events";

/**
 * Odesílání událostí z prohlížeče.
 *
 * Fire-and-forget: měření nikdy nesmí zdržet ani rozbít to, co dítě dělá.
 * Chyba se spolkne a nanejvýš se objeví ve vývojářské konzoli.
 *
 * Anonym zapisuje taky — politika `events_insert_anon` mu to dovolí pod
 * podmínkou, že parent_id i child_id jsou null. Bez toho by chyběl
 * jmenovatel metriky brány 1.
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

/* Zabraňuje dvojímu odeslání téže události při rychlém překreslení
   v Reactu (StrictMode volá efekty dvakrát). Klíč žije jen v paměti
   záložky, takže reload měří znovu — a to je správně. */
const sentOnce = new Set<string>();

function cleanProps(props: EventProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined) continue;
    out[key] = typeof value === "string" ? value.slice(0, 500) : value;
  }
  return out;
}

export async function track(name: EventName, props: EventProps = {}): Promise<void> {
  if (typeof window === "undefined") return;

  if (isServerOnlyEvent(name)) {
    /* Tichý návrat by tuhle chybu schoval až do chvíle, kdy se v datech
       objeví nákup, který nikdo nezaplatil. */
    if (process.env.NODE_ENV !== "production") {
      console.error(`[analytics] Událost "${name}" smí zapsat jen server.`);
    }
    return;
  }

  try {
    const session = ensureAnonSession();
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();

    await supabase.from("learning_events").insert({
      type: name,
      /* anon_id se posílá vždy, i u přihlášeného. Díky tomu jde spojit
         cestu před registrací s tím, co se dělo po ní — a spočítat, kolik
         lidí ze zdi opravdu dojde k účtu. */
      anon_id: session.anonId,
      parent_id: data.user?.id ?? null,
      props: cleanProps(props),
    });
  } catch {
    /* Měření nesmí shodit lekci. */
  }
}

/** Odešle událost nejvýš jednou za život záložky. */
export async function trackOnce(
  name: EventName,
  key: string,
  props: EventProps = {},
): Promise<void> {
  const dedupeKey = `${name}:${key}`;
  if (sentOnce.has(dedupeKey)) return;
  sentOnce.add(dedupeKey);
  await track(name, props);
}

export { EVENT };
