"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COOKIE_SETTINGS_EVENT } from "./consent";
import { readCookieConsent, saveCookieConsent, useCookieConsent } from "./store";
import { Button } from "@/components/ui/Button";

/**
 * Lišta souhlasu s cookies. Odmítnout je stejně snadné jako přijmout:
 * „Odmítnout vše" a „Přijmout vše" mají stejnou váhu. Žádná kategorie
 * není předvyplněná. Amber je jen u „Uložit výběr" v podrobném nastavení.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const consent = useCookieConsent();
  // Otevřeno z patičky („Nastavení cookies"), i když už někdo rozhodl.
  const [reopened, setReopened] = useState(false);
  const [details, setDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const onSettings = () => {
      const c = readCookieConsent();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setDetails(true);
      setReopened(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, onSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, onSettings);
  }, []);

  // undefined = ještě se neví (server, hydratace) → nic nevykreslovat.
  if (consent === undefined) return null;
  const open = consent === null || reopened;
  // Tábor je zamrazený legacy režim bez měření, lišta tam nepatří.
  if (!open || pathname.startsWith("/tabor")) return null;

  function decide(choice: { analytics: boolean; marketing: boolean }) {
    saveCookieConsent(choice);
    setReopened(false);
    setDetails(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Nastavení cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-ink bg-paper p-4 shadow-hard sm:p-5"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-ink-500">Cookies</p>
          <p className="mt-1 text-sm text-ink">
            Nezbytné věci učebna potřebuje vždy. Měření návštěvnosti (Google Analytics)
            a reklamní měření (Meta Pixel) zapneme jen po vašem souhlasu. Více v{" "}
            <Link href="/ochrana-udaju" className="font-semibold underline underline-offset-4">
              ochraně údajů
            </Link>
            .
          </p>
        </div>

        {details && (
          <div className="divide-y divide-ink/15 border-y border-ink/15">
            <Toggle
              label="Nezbytné"
              hint="Pamatují si váš výběr a přihlášení. Nelze vypnout."
              checked
              disabled
            />
            <Toggle
              label="Analytické (Google Analytics)"
              hint="Anonymní statistiky o tom, které lekce se dokončují a kde se ztrácí."
              checked={analytics}
              onChange={setAnalytics}
            />
            <Toggle
              label="Marketingové (Meta Pixel)"
              hint="Měření reklam. Na dětských obrazovkách se nikdy nespouští."
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            type="button"
            onClick={() => decide({ analytics: false, marketing: false })}
            variant="outline" size="sm"
          >
            Odmítnout vše
          </Button>
          {details ? (
            <Button
              type="button"
              onClick={() => decide({ analytics, marketing })}
              variant="primary" size="sm"
            >
              Uložit výběr
            </Button>
          ) : (
            <>
              <Button
                type="button"
                onClick={() => setDetails(true)}
                aria-expanded={false}
                variant="outline" size="sm"
              >
                Nastavit
              </Button>
              <Button
                type="button"
                onClick={() => decide({ analytics: true, marketing: true })}
                variant="outline" size="sm"
              >
                Přijmout vše
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{label}</p>
        <p className="mt-0.5 text-xs text-ink-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 border-ink ${
          checked ? "bg-primary-600" : "bg-paper-soft"
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-ink transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
