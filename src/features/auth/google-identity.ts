"use client";

/**
 * Načtení Google Identity Services (tlačítko „Přihlásit přes Google“).
 *
 * Skript se načítá JEN na přihlašovacích stránkách, ne v layoutu — ostatní
 * stránky o něm nemusí vědět a nic cizího se jim nestahuje. CSP ho pouští
 * v next.config.ts.
 */

export const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

export interface GoogleCredentialResponse {
  /** ID token (JWT), který posíláme do Supabase. */
  credential: string;
}

export interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    /** HASH surového nonce. Surový jde do Supabase. */
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      width?: number;
      locale?: string;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

let pending: Promise<GoogleIdApi> | null = null;

/** Vrátí API, až je skript připravený. Opakované volání nic nenačítá znovu. */
export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);

  if (!pending) {
    pending = new Promise<GoogleIdApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = GIS_SCRIPT_SRC;
      script.async = true;
      script.onload = () => {
        const api = window.google?.accounts?.id;
        if (api) resolve(api);
        else {
          pending = null;
          reject(new Error("Google Identity Services se nenačetly"));
        }
      };
      script.onerror = () => {
        pending = null;
        script.remove();
        reject(new Error("Skript Google Identity Services se nepodařilo stáhnout"));
      };
      document.head.appendChild(script);
    });
  }
  return pending;
}
