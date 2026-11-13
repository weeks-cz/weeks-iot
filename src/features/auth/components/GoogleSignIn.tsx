"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/Surface";
import { createClient } from "@/lib/supabase/client";
import { completeGoogleSignInAction } from "../actions";
import { loginErrorMessage } from "../errors";
import { generateRawNonce, hashNonce } from "../google";
import { loadGoogleIdentity, type GoogleCredentialResponse, type GoogleIdApi } from "../google-identity";
import { GoogleButton } from "./GoogleButton";
import { EVENT, track } from "@/features/analytics/track";
import { currentEnvironment } from "@/features/analytics/environment";

export type GooglePage = "registrace" | "prihlaseni";

type GoogleEvent =
  | typeof EVENT.AUTH_GOOGLE_CLICK
  | typeof EVENT.AUTH_GOOGLE_SUCCESS
  | typeof EVENT.AUTH_GOOGLE_ERROR;

/** Každá událost Googlu nese stránku a prostředí — hypotéza je, že ve
 *  vestavěném prohlížeči Facebooku a Instagramu Google nefunguje. */
export function trackGoogle(
  name: GoogleEvent,
  page: GooglePage,
  props: Record<string, string> = {},
): void {
  void track(name, { page, env: currentEnvironment(), ...props });
}

/** Rozsah šířky, který GIS tlačítko přijme (v pixelech). */
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

/**
 * Přihlášení Googlem přímo na stránce.
 *
 * Místo přesměrování přes supabase.co: účet Google se ukáže s názvem
 * učebny, ne s adresou projektu. Google vydá ID token, ten jde do Supabase
 * a session se založí v prohlížeči; pak server rozhodne, kam dál.
 *
 * Když chybí `clientId` (NEXT_PUBLIC_GOOGLE_CLIENT_ID), nebo se skript
 * Googlu nestáhne (blokátor), zůstává přesměrovací tok — přihlásit se jde
 * vždycky.
 */
export function GoogleSignIn({
  next,
  clientId,
  page,
}: {
  next: string;
  clientId: string | null;
  /** Kde tlačítko stojí — pro měření. Účet jde založit z obou stránek. */
  page: GooglePage;
}) {
  const [fallback, setFallback] = useState(clientId === null);
  const [error, setError] = useState<string | undefined>();
  const holderRef = useRef<HTMLDivElement>(null);

  /* Stejně jako `next`: callbacky GIS vznikají jednou, stránka se čte z ref. */
  const pageRef = useRef(page);
  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  /* Callback vzniká jednou, `next` ale může být jiný — čte se proto z ref,
     který se aktualizuje v efektu (zápis do ref při renderu React nechce). */
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    const holder = holderRef.current;
    if (!clientId || !holder) return;

    let cancelled = false;
    let rawNonce = "";
    let lastWidth = 0;
    let observer: ResizeObserver | undefined;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      setError(undefined);
      const { error: signInError } = await createClient().auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        /* SUROVÝ nonce. Hash už má Google z initialize(). */
        nonce: rawNonce,
      });

      if (signInError) {
        console.warn("[auth] Přihlášení přes Google selhalo:", signInError.message);
        /* Jen kód místa, ne text chyby — ten může nést e-mail. */
        trackGoogle(EVENT.AUTH_GOOGLE_ERROR, pageRef.current, { stage: "token" });
        setError(loginErrorMessage("google"));
        return;
      }

      /* Rodič je teď přihlášený, takže řádek ponese anon_id i parent_id
         a spáruje cestu před registrací s tou po ní. Přesměrování z akce
         je navigace uvnitř aplikace, rozběhnutý zápis neutne. */
      trackGoogle(EVENT.AUTH_GOOGLE_SUCCESS, pageRef.current);

      /* Při úspěchu server přesměruje (redirect uvnitř akce), takže se sem
         už nedostaneme. Při chybě vrátí výjimku a uživatel uvidí chybu. */
      await completeGoogleSignInAction(nextRef.current);
    };

    const render = (api: GoogleIdApi) => {
      const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.floor(holder.clientWidth)));
      /* GIS tlačítko má pevnou šířku, takže se vykresluje znovu jen při její
         změně. Jinak by se úzký displej přelévající tlačítko vykreslil stále
         dokola. */
      if (width === lastWidth) return;
      lastWidth = width;
      holder.replaceChildren();
      api.renderButton(holder, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width,
        locale: "cs",
        /* Klik bez následného úspěchu je ve vestavěném prohlížeči Facebooku
           nejspíš častější než chyba: okno Googlu se prostě neotevře. */
        click_listener: () => trackGoogle(EVENT.AUTH_GOOGLE_CLICK, pageRef.current, { mode: "gis" }),
      });
    };

    loadGoogleIdentity()
      .then(async (api) => {
        rawNonce = generateRawNonce();
        const hashed = await hashNonce(rawNonce);
        if (cancelled) return;

        api.initialize({
          client_id: clientId,
          callback: (response) => void handleCredential(response),
          nonce: hashed,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        render(api);

        observer = new ResizeObserver(() => {
          if (!cancelled) render(api);
        });
        observer.observe(holder);
      })
      .catch(() => {
        if (cancelled) return;
        /* Skript Googlu se nestáhl (blokátor, vestavěný prohlížeč).
           Rodič dostane přesměrovací tlačítko, ale chceme vědět, jak často. */
        trackGoogle(EVENT.AUTH_GOOGLE_ERROR, pageRef.current, { stage: "script" });
        setFallback(true);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [clientId]);

  if (fallback) {
    return (
      <div className="flex flex-col gap-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <GoogleButton
          next={next}
          onClick={() => trackGoogle(EVENT.AUTH_GOOGLE_CLICK, page, { mode: "redirect" })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {/* Kontejner drží místo, dokud skript nedoběhne, aby formulář pod ním
          neposkočil. GIS vykresluje vlastní iframe — styl nejde přepsat,
          jen šířka a motiv. */}
      <div
        ref={holderRef}
        className="flex min-h-11 w-full justify-center"
        aria-label="Přihlásit přes Google"
      />
    </div>
  );
}
