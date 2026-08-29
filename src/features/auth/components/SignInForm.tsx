"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Surface";
import { magicLinkAction, signInAction, type ActionState } from "../actions";

const EMPTY: ActionState = {};

/**
 * Přihlášení.
 *
 * Dvě cesty na jedné obrazovce: heslo a magic link. Přepínač je záměrně
 * viditelný — rodič, který si heslo nepamatuje, jinak skončí u obnovy
 * hesla, což je delší cesta se stejným výsledkem.
 */
export function SignInForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [passwordState, passwordSubmit, passwordPending] = useActionState(signInAction, EMPTY);
  const [magicState, magicSubmit, magicPending] = useActionState(magicLinkAction, EMPTY);

  const state = mode === "password" ? passwordState : magicState;

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Způsob přihlášení" className="flex gap-1 rounded-md bg-paper-soft p-1">
        {(
          [
            ["password", "Heslem"],
            ["magic", "Odkazem v e-mailu"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`min-h-11 flex-1 rounded-sm px-3 text-sm font-semibold transition-colors ${
              mode === value ? "bg-white text-ink shadow-hard-sm" : "text-ink-500 hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      {mode === "password" ? (
        <form action={passwordSubmit} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="next" value={next} />

          <TextField
            label="E-mail rodiče"
            name="email"
            type="email"
            /* username schválně i u e-mailu: správci hesel podle toho
               spárují záznam se stránkou. */
            autoComplete="username"
            inputMode="email"
            required
            mono
            error={passwordState.fieldErrors?.email}
          />

          <TextField
            label="Heslo"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            error={passwordState.fieldErrors?.password}
          />

          <Button type="submit" fullWidth loading={passwordPending}>
            Přihlásit se
          </Button>

          <Link
            href="/obnova-hesla"
            className="self-center rounded-sm text-sm text-ink-500 underline underline-offset-4 hover:text-ink"
          >
            Zapomenuté heslo
          </Link>
        </form>
      ) : (
        <form action={magicSubmit} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="next" value={next} />

          <TextField
            label="E-mail rodiče"
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            mono
            hint="Pošleme vám odkaz, kterým se přihlásíte bez hesla."
            error={magicState.fieldErrors?.email}
          />

          <Button type="submit" fullWidth loading={magicPending}>
            Poslat odkaz
          </Button>
        </form>
      )}
    </div>
  );
}
