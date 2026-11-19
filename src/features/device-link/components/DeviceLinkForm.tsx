"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Surface";
import { EVENT, track } from "@/features/analytics/track";
import { currentEnvironment } from "@/features/analytics/environment";
import { readAnonSession } from "@/features/anon-session/storage";
import { DEVICE_LINK_MARKETING_TEXT } from "@/features/consent/texts";
import { fbqTrack } from "@/features/cookies/vendors";
import type { ActionState } from "@/features/actions";
import { cn } from "@/lib/cn";
import { requestDeviceLink } from "../actions";
import { detectDevice, type DeviceVariant } from "../device";

export type { DeviceVariant };

/**
 * `auto`: o podobě rozhodne CSS podle ukazatele (`pointer-fine:`), takže
 * HTML ze serveru je správně na telefonu i na počítači, i bez skriptu.
 * JavaScript zařízení zjišťuje jen kvůli měření.
 */
export type FormVariant = DeviceVariant | "auto";

const EMPTY: ActionState = {};

/* Nezlomitelná mezera vždy přes konstantu, nikdy jako neviditelný znak. */
const NBSP = "\u00a0";

const HEADING: Record<DeviceVariant, string> = {
  mobile: `Nejlíp to jde na počítači s${NBSP}myší. Pošleme vám odkaz.`,
  /* Na počítači rodič lekci může spustit hned; formulář je pro „teď ne“,
     ne pro jiný počítač – ten by tomu, kdo u počítače sedí, nedával smysl. */
  desktop: "Nemáte teď čas? Pošleme vám odkaz e-mailem.",
};

const SUBMIT_LABEL: Record<DeviceVariant, string> = {
  mobile: "Poslat odkaz na počítač",
  desktop: "Poslat odkaz e-mailem",
};

const HEADING_CLASS =
  "mb-4 font-display text-xl font-semibold leading-snug text-balance text-ink";

/* Vzhled varianty „secondary“ z `Button.tsx`, jen pod `pointer-fine:`.
   Amber patří hlavní akci: na telefonu odeslání, na počítači lekce. */
const SUBMIT_ON_DESKTOP =
  "pointer-fine:bg-ink pointer-fine:text-paper pointer-fine:hover:bg-ink-700";

const GENERIC_ERROR = "Odeslání se nepovedlo. Zkuste to prosím znovu.";

function newEventId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "";
}

/**
 * Formulář „Pošlete si odkaz na počítač“.
 *
 * Znovupoužitelný: dnes stojí na `/pro-rodice`, později může i na `/`.
 * Podle zařízení se mění jen nadpis a váha tlačítka. Pevná `variant`
 * vykreslí jednu podobu, `auto` obě a tu nesprávnou schová CSS.
 *
 * Na server jde jen to, co rodič vyplnil, a zdroj návštěvy z anonymní
 * relace (UTM, referrer, fbclid, prostředí). Nikdy `anonId` ani postup
 * v lekcích. Zdroj se přidává až při odeslání, takže v HTML ze serveru
 * nejsou žádná skrytá pole, která by se po hydrataci přepisovala.
 *
 * `eventId` pro Meta (Pixel `Lead` v prohlížeči + CAPI na serveru se
 * stejným id) vzniká až na klientovi po připojení. Při renderu by se
 * id ze serveru a z prohlížeče lišila.
 */
export function DeviceLinkForm({
  variant,
  className,
}: {
  variant: FormVariant;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(requestDeviceLink, EMPTY);
  /* Potvrzení, které rodič zavřel tlačítkem „Poslat na jiný e-mail“. */
  const [dismissed, setDismissed] = useState<ActionState | null>(null);

  const eventId = useRef("");
  const submittedEventId = useRef("");
  const leadSentFor = useRef<ActionState | null>(null);
  const viewSent = useRef(false);
  const successBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!eventId.current) eventId.current = newEventId();
  }, []);

  /* Jednou za připojení. U `auto` se zařízení zjistí až tady, v prohlížeči. */
  useEffect(() => {
    if (viewSent.current) return;
    viewSent.current = true;
    void track(EVENT.DEVICE_LINK_VIEW, {
      variant: variant === "auto" ? detectDevice() : variant,
    });
  }, [variant]);

  /* Pixel `Lead` jednou za úspěšné odeslání, s id, které odešlo na server.
     Bez souhlasu s cookies Pixel není načtený a volání nic neudělá.
     Další odeslání dostane nové id, jinak by ho Meta zahodila jako duplicitu. */
  useEffect(() => {
    if (!state.success || leadSentFor.current === state) return;
    leadSentFor.current = state;
    fbqTrack("Lead", {}, submittedEventId.current || undefined);
    eventId.current = newEventId();
    /* Formulář zmizel i s fokusem; čtečka má potvrzení přečíst hned. */
    successBox.current?.focus();
  }, [state]);

  /* React 19 po odeslání formuláře s `action` vynuluje pole i při chybě.
     S JavaScriptem proto odesíláme sami a e-mail s překlepem zůstane
     v poli. Bez JavaScriptu formulář dál funguje přes `action`. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const attribution = readAnonSession()?.attribution ?? {};
    const extra: Record<string, string | undefined> = {
      utmSource: attribution.utmSource,
      utmMedium: attribution.utmMedium,
      utmCampaign: attribution.utmCampaign,
      utmContent: attribution.utmContent,
      utmTerm: attribution.utmTerm,
      referrer: attribution.referrer,
      fbclid: attribution.fbclid,
      env: currentEnvironment(),
      eventId: eventId.current,
    };
    for (const [key, value] of Object.entries(extra)) {
      if (value) data.set(key, value);
    }
    submittedEventId.current = eventId.current;

    startTransition(() => formAction(data));
  }

  const showSuccess = Boolean(state.success) && dismissed !== state;
  const emailError = state.fieldErrors?.email;
  const otherError =
    state.error ?? (state.fieldErrors && !emailError ? GENERIC_ERROR : undefined);

  return (
    <div
      className={cn(
        "rounded-md border border-ink bg-white p-5 text-ink shadow-hard sm:p-6",
        className,
      )}
    >
      {variant === "auto" ? (
        <>
          <h2 className={cn(HEADING_CLASS, "pointer-fine:hidden")}>{HEADING.mobile}</h2>
          <h2 className={cn(HEADING_CLASS, "hidden pointer-fine:block")}>{HEADING.desktop}</h2>
        </>
      ) : (
        <h2 className={HEADING_CLASS}>{HEADING[variant]}</h2>
      )}

      {showSuccess ? (
        <div className="flex flex-col items-start gap-3">
          <div ref={successBox} tabIndex={-1} className="w-full outline-none">
            <Alert tone="success" title="Odesláno">
              {state.success}
            </Alert>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(state)}
            className="text-sm font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            Poslat na jiný e-mail
          </button>
        </div>
      ) : (
        <form
          action={formAction}
          onSubmit={handleSubmit}
          noValidate
          className="relative flex flex-col gap-4"
        >
          {otherError && <Alert tone="danger">{otherError}</Alert>}

          <TextField
            label="Váš e-mail"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            mono
            maxLength={254}
            placeholder="vas@email.cz"
            error={emailError}
          />

          {/* Past na roboty. Člověk ji nevidí a čtečka ji přeskočí;
              vyplněnou vyřídí server tichým „hotovo“ bez odeslání. */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
            <label>
              Nechte prázdné
              <input type="text" name="hp_field_x" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>

          {/* Souhlas stojí před tlačítkem (návrh §2, cíl 6): kdo ho chce dát,
              musí ho vidět dřív, než odešle. Znění se ukládá do ledgeru,
              mění se jen velikost písma, aby tlačítko na telefonu zůstalo
              co nejvýš. */}
          <Checkbox
            name="marketingConsent"
            /* Žádné defaultChecked. Předvyplněný souhlas není souhlas. */
            label={
              <span className="block text-xs leading-snug">{DEVICE_LINK_MARKETING_TEXT.label}</span>
            }
            details={
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-primary-600 underline underline-offset-4">
                  Zobrazit plné znění
                </summary>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-sm bg-paper-soft p-3">
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-500">
                    {DEVICE_LINK_MARKETING_TEXT.full}
                  </pre>
                </div>
              </details>
            }
          />

          <Button
            type="submit"
            variant={variant === "desktop" ? "secondary" : "primary"}
            className={variant === "auto" ? SUBMIT_ON_DESKTOP : undefined}
            fullWidth
            loading={pending}
          >
            {variant === "auto" ? (
              <>
                <span className="pointer-fine:hidden">{SUBMIT_LABEL.mobile}</span>
                <span className="hidden pointer-fine:inline">{SUBMIT_LABEL.desktop}</span>
              </>
            ) : (
              SUBMIT_LABEL[variant]
            )}
          </Button>

          <p className="text-sm leading-relaxed text-ink-500">
            E-mail použijeme k{NBSP}odeslání odkazu. Více v{NBSP}
            <Link
              href="/ochrana-udaju"
              className="font-semibold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
            >
              ochraně údajů
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}
