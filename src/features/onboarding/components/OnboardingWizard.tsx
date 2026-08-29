"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox, SelectField, TextField } from "@/components/ui/Field";
import { Alert, MonoLabel, Stepper } from "@/components/ui/Surface";
import { useAnonSessionRaw } from "@/features/anon-session/useAnonSession";
import { AVATARS, Avatar } from "@/features/children/avatars";
import { consentTextsForAge } from "@/features/consent/texts";
import type { ActionState } from "@/features/actions";
import { completeOnboardingAction } from "../actions";
import { birthYearRange, needsParentalConsent } from "../schema";

const STEPS = ["Kdo se učí", "Kraj", "Souhlasy"] as const;
const EMPTY: ActionState = {};

interface RegionOption {
  code: string;
  name: string;
  isCatchment: boolean;
}

/** Ke kterému kroku patří chyba ze serveru. null = k žádnému. */
function stepForErrors(errors: Record<string, string> | undefined): number | null {
  if (!errors) return null;
  if (errors.childNick || errors.childBirthYear) return 0;
  if (errors.regionCode) return 1;
  if (errors.acceptTerms || errors.parentalConsent || errors.selfConsent) return 2;
  return null;
}

/**
 * Onboarding.
 *
 * Rok narození se ptá jako PRVNÍ, protože rozhoduje o všem ostatním:
 * dítě do 15 let potřebuje souhlas zákonného zástupce, od 15 let člověk
 * souhlasí sám za sebe (§ 7 zák. 110/2019). Kdyby se ptal až nakonec,
 * překreslil by se poslední krok pod rukama.
 *
 * Jeden formulář, tři kroky, jedna URL. Odesílá se až celek — dělené
 * ukládání by nechávalo v databázi poloviční účty bez souhlasu.
 */
export function OnboardingWizard({ regions }: { regions: RegionOption[] }) {
  const [step, setStep] = useState(0);
  const [birthYear, setBirthYear] = useState("");
  const [state, submit, pending] = useActionState(completeOnboardingAction, EMPTY);

  const anonSession = useAnonSessionRaw();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  /* Úprava stavu během renderu, ne v efektu — efekt by komponentu
     překreslil dvakrát a formulář by blikl na špatném kroku. */
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

  /* Dokud rok není vybraný, počítáme s nezletilým — přísnější varianta
     je ta bezpečná. */
  const isMinor = birthYear === "" || needsParentalConsent(Number(birthYear));
  const consents = consentTextsForAge(isMinor);

  return (
    <form action={submit} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="anonSession" value={anonSession} />

      <Stepper steps={STEPS} current={step} />

      <h2 ref={headingRef} tabIndex={-1} className="heading-3 text-ink outline-none">
        {step === 0 && "Kdo se bude učit?"}
        {step === 1 && "Odkud jste?"}
        {step === 2 && "Ještě souhlasy"}
      </h2>

      {state.error && <Alert tone="danger">{state.error}</Alert>}

      {/* Kroky zůstávají v DOMu a jen se skrývají — odmontované pole by
          prohlížeč při odeslání neposlal. `hidden` je zároveň vyřadí
          z pořadí tabulátoru i z přístupnostního stromu. */}

      {/* ── Krok 1: kdo se učí ───────────────────────────────────────── */}
      <fieldset hidden={step !== 0} className="m-0 flex flex-col gap-4 border-0 p-0">
        <legend className="sr-only">Profil učícího se</legend>

        <SelectField
          label="Rok narození"
          name="childBirthYear"
          required
          mono
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          hint="Ukládáme jen rok, ne přesné datum. Podle něj poznáme, kdo musí podepsat souhlas."
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

        {birthYear !== "" && (
          <Alert tone={isMinor ? "info" : "success"}>
            {isMinor
              ? "Účet spravuje rodič a v posledním kroku potvrdí souhlas zákonného zástupce. U dětí do 15 let to vyžaduje zákon."
              : "Od 15 let si účet spravuješ sám — souhlas podepíšeš za sebe a rodiče k tomu nepotřebuješ."}
          </Alert>
        )}

        <TextField
          label={isMinor ? "Přezdívka dítěte" : "Tvoje přezdívka"}
          name="childNick"
          maxLength={24}
          required
          autoComplete="off"
          hint={
            isMinor
              ? "Nemusí to být skutečné jméno. Uvidíte ji jen vy a dítě."
              : "Nemusí to být tvoje skutečné jméno."
          }
          error={state.fieldErrors?.childNick}
        />

        <div>
          <MonoLabel className="mb-2">Avatar</MonoLabel>
          {/* auto-fill místo pevného počtu sloupců: dlaždice se přizpůsobí
              šířce, takže delší popisky jako „Ozubené kolo" nevytečou ven. */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2">
            {AVATARS.map((avatar, index) => (
              <label
                key={avatar.id}
                className="flex cursor-pointer flex-col items-center gap-1.5 rounded-md border
                           border-ink/15 bg-white px-1.5 py-3 text-center transition-colors
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
                <Avatar id={avatar.id} className="block size-8 text-ink" />
                {/* break-words: delší popisek se zalomí uvnitř dlaždice
                    místo aby přetekl přes okraj. */}
                <span className="break-words text-[0.6875rem] leading-tight text-ink-500">
                  {avatar.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        <Button type="button" onClick={() => setStep(1)} fullWidth>
          Pokračovat
        </Button>
      </fieldset>

      {/* ── Krok 2: kraj ─────────────────────────────────────────────── */}
      <fieldset hidden={step !== 1} className="m-0 flex flex-col gap-4 border-0 p-0">
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

        {consents.map((text) => {
          const name =
            text.kind === "terms"
              ? "acceptTerms"
              : text.kind === "parental"
                ? "parentalConsent"
                : text.kind === "self"
                  ? "selfConsent"
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
