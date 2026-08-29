"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextField } from "@/components/ui/Field";
import { Alert, MonoLabel, Stepper } from "@/components/ui/Surface";
import { useAnonSessionRaw } from "@/features/anon-session/useAnonSession";
import { CONSENT_TEXTS } from "@/features/consent/texts";
import type { ActionState } from "@/features/actions";
import { AVATARS } from "@/features/children/avatars";
import { completeOnboardingAction } from "../actions";
import { birthYearRange } from "../schema";

const STEPS = ["Kraj", "Dítě", "Souhlasy"] as const;
const EMPTY: ActionState = {};

/** Ke kterému kroku patří chyba ze serveru. null = k žádnému. */
function stepForErrors(errors: Record<string, string> | undefined): number | null {
  if (!errors) return null;
  if (errors.regionCode) return 0;
  if (errors.childNick || errors.childBirthYear) return 1;
  if (errors.acceptTerms || errors.parentalConsent) return 2;
  return null;
}

interface RegionOption {
  code: string;
  name: string;
  isCatchment: boolean;
}

/**
 * Onboarding rodiče.
 *
 * Jeden formulář, tři kroky, jedna URL. Kroky jako samostatné stránky by
 * znamenaly, že zpětné tlačítko vyhodí z rozdělaného formuláře — a že se
 * do databáze musí zapisovat po částech, tedy i poloviční účty bez souhlasu.
 *
 * Odesílá se až celek. Do té doby nic neopustí prohlížeč.
 */
export function OnboardingWizard({ regions }: { regions: RegionOption[] }) {
  const [step, setStep] = useState(0);
  const [state, submit, pending] = useActionState(completeOnboardingAction, EMPTY);

  /* Relace se čte přes useSyncExternalStore, ne přes useState v efektu:
     nespustí to kaskádu překreslení a nevznikne rozdíl mezi serverovým
     a klientským výstupem. */
  const anonSession = useAnonSessionRaw();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  /* Po přechodu na další krok se fokus přesune na jeho nadpis. Bez toho
     zůstane u tlačítka „Pokračovat", čtečka nic neoznámí a uživatel
     klávesnice se ocitne uprostřed formuláře, který nevidí. */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  /* Chyba z validace na serveru může patřit ke kroku, který není vidět.
     Bez přepnutí by odeslání „nic neudělalo" a nikdo by nevěděl proč.

     Úprava stavu během renderu, ne v efektu — je to postup, který React
     pro odvození stavu z props doporučuje. Efekt by komponentu překreslil
     dvakrát a formulář by na okamžik blikl na špatném kroku. */
  const [seenErrors, setSeenErrors] = useState(state.fieldErrors);
  if (state.fieldErrors !== seenErrors) {
    setSeenErrors(state.fieldErrors);
    const target = stepForErrors(state.fieldErrors);
    if (target !== null) setStep(target);
  }

  const { min, max } = birthYearRange();
  const years = Array.from({ length: max - min + 1 }, (_, i) => max - i);

  const catchment = regions.filter((r) => r.isCatchment);
  const rest = regions.filter((r) => !r.isCatchment);

  return (
    <form action={submit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="anonSession" value={anonSession} />

      <Stepper steps={STEPS} current={step} />

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="heading-3 text-ink outline-none"
      >
        {step === 0 && "Odkud jste?"}
        {step === 1 && "Kdo se bude učit?"}
        {step === 2 && "Ještě souhlasy"}
      </h2>

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      {/* Kroky zůstávají v DOMu a jen se skrývají. Kdyby se odmontovaly,
          přišel by uživatel při návratu o vyplněné hodnoty a prohlížeč by
          neodeslal pole, která zrovna nejsou vidět. */}

      {/* ── Krok 1: kraj ─────────────────────────────────────────────── */}
      <fieldset hidden={step !== 0} className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="sr-only">Kraj</legend>

        <SelectField
          label="Kraj, ve kterém bydlíte"
          name="regionCode"
          required
          defaultValue=""
          hint="Podle kraje poznáme, jestli k vám jezdíme s letním táborem."
          error={state.fieldErrors?.regionCode}
        >
          <option value="" disabled>
            Vyberte kraj
          </option>
          <optgroup label="Jezdíme sem s táborem">
            {catchment.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ostatní kraje">
            {rest.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </optgroup>
        </SelectField>

        <Button type="button" onClick={() => setStep(1)} fullWidth>
          Pokračovat
        </Button>
      </fieldset>

      {/* ── Krok 2: dítě ─────────────────────────────────────────────── */}
      <fieldset hidden={step !== 1} className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="sr-only">Profil dítěte</legend>

        <TextField
          label="Přezdívka dítěte"
          name="childNick"
          maxLength={24}
          required
          autoComplete="off"
          hint="Nemusí to být skutečné jméno. Uvidí ji jen vy a dítě."
          error={state.fieldErrors?.childNick}
        />

        <SelectField
          label="Rok narození"
          name="childBirthYear"
          required
          defaultValue=""
          mono
          hint="Ukládáme jen rok, ne přesné datum — na věkovou skupinu to stačí."
          error={state.fieldErrors?.childBirthYear}
        >
          <option value="" disabled>
            Vyberte rok
          </option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>

        <div>
          <MonoLabel className="mb-2">Avatar</MonoLabel>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {AVATARS.map((avatar, index) => (
              <label
                key={avatar.id}
                className="flex cursor-pointer flex-col items-center gap-1 rounded-md border
                           border-ink/15 bg-white p-3 transition-colors
                           hover:border-ink
                           has-[:checked]:border-ink has-[:checked]:bg-primary-50
                           has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
                           has-[:focus-visible]:outline-ink"
              >
                <input
                  type="radio"
                  name="childAvatar"
                  value={avatar.id}
                  defaultChecked={index === 0}
                  className="sr-only"
                />
                <span className="text-2xl" aria-hidden="true">
                  {avatar.glyph}
                </span>
                <span className="text-xs text-ink-500">{avatar.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep(0)}>
            Zpět
          </Button>
          <Button type="button" onClick={() => setStep(2)} fullWidth>
            Pokračovat
          </Button>
        </div>
      </fieldset>

      {/* ── Krok 3: souhlasy ─────────────────────────────────────────── */}
      <fieldset hidden={step !== 2} className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="sr-only">Souhlasy</legend>

        {CONSENT_TEXTS.map((text) => {
          const name =
            text.kind === "terms"
              ? "acceptTerms"
              : text.kind === "parental"
                ? "parentalConsent"
                : "marketingConsent";

          return (
            <Checkbox
              key={text.kind}
              name={name}
              required={text.required}
              /* Žádné defaultChecked. Předvyplněný souhlas není souhlas. */
              label={text.label}
              error={state.fieldErrors?.[name]}
              details={
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-primary-600 underline underline-offset-4">
                    Zobrazit plné znění
                  </summary>
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-sm bg-paper-soft p-3">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-500">
                      {text.full}
                    </pre>
                  </div>
                </details>
              }
            />
          );
        })}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => setStep(1)}>
            Zpět
          </Button>
          <Button type="submit" fullWidth loading={pending}>
            Dokončit registraci
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
