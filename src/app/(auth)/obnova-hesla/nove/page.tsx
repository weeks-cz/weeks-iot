"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Surface";
import { setNewPasswordAction, type ActionState } from "@/features/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/features/onboarding/schema";

const EMPTY: ActionState = {};

/**
 * Nastavení nového hesla.
 *
 * Sem se člověk dostane přes odkaz z e-mailu, který mu vyměnil token za
 * session. Bez ní `updateUser` tiše neudělá nic — proto to server action
 * kontroluje a hlásí vypršelý odkaz.
 */
export default function NewPasswordPage() {
  const [state, submit, pending] = useActionState(setNewPasswordAction, EMPTY);

  return (
    <AuthShell
      eyebrow="Rodičovský účet"
      title="Nové heslo"
      lead="Zadejte heslo, kterým se budete přihlašovat."
    >
      <form action={submit} className="flex flex-col gap-4" noValidate>
        {state.error && <Alert tone="danger">{state.error}</Alert>}

        <TextField
          label="Nové heslo"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={`Aspoň ${MIN_PASSWORD_LENGTH} znaků.`}
          error={state.fieldErrors?.password}
        />

        <TextField
          label="Heslo znovu"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirm}
        />

        <Button type="submit" fullWidth loading={pending}>
          Uložit heslo
        </Button>
      </form>
    </AuthShell>
  );
}
