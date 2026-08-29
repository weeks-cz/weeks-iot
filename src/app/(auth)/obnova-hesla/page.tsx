"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthShell } from "@/components/ui/AuthShell";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { requestPasswordResetAction } from "@/features/auth/actions";

const EMPTY: ActionState = {};

export default function PasswordResetPage() {
  const [state, submit, pending] = useActionState(requestPasswordResetAction, EMPTY);

  return (
    <AuthShell
      eyebrow="Rodičovský účet"
      title="Zapomenuté heslo"
      lead="Pošleme vám odkaz, kterým si nastavíte nové."
      aside={
        <p>
          Vzpomněli jste si?{" "}
          <Link href="/prihlaseni" className="font-semibold text-primary-600 underline underline-offset-4">
            Zpět na přihlášení
          </Link>
        </p>
      }
    >
      {state.success ? (
        <Alert tone="success" title="Zkontrolujte si e-mail">
          {state.success}
        </Alert>
      ) : (
        <form action={submit} className="flex flex-col gap-4" noValidate>
          {state.error && <Alert tone="danger">{state.error}</Alert>}

          <TextField
            label="E-mail rodiče"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            mono
            error={state.fieldErrors?.email}
          />

          <Button type="submit" fullWidth loading={pending}>
            Poslat odkaz
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
