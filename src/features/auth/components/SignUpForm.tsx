"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Surface";
import { MIN_PASSWORD_LENGTH } from "@/features/onboarding/schema";
import type { ActionState } from "@/features/actions";
import { signUpAction } from "../actions";

const EMPTY: ActionState = {};

export function SignUpForm() {
  const [state, submit, pending] = useActionState(signUpAction, EMPTY);

  /* Po odeslání se formulář schová. Kdyby zůstal viditelný pod hláškou
     „poslali jsme e-mail", polovina lidí ho odešle znovu. */
  if (state.success) {
    return (
      <Alert tone="success" title="Zkontrolujte si e-mail">
        {state.success}
      </Alert>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <TextField
        label="Váš e-mail"
        name="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        required
        mono
        hint="Sem vám budeme posílat certifikát a měsíční přehled toho, co dítě dokázalo."
        error={state.fieldErrors?.email}
      />

      <TextField
        label="Heslo"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`Aspoň ${MIN_PASSWORD_LENGTH} znaků. Tři náhodná slova za sebou jsou lepší než jedno s vykřičníkem.`}
        error={state.fieldErrors?.password}
      />

      <Button type="submit" fullWidth loading={pending}>
        Založit účet
      </Button>

      <p className="text-xs leading-relaxed text-ink-500">
        V dalším kroku vyberete kraj, vytvoříte profil dítěte a potvrdíte souhlasy.
      </p>
    </form>
  );
}
