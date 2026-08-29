"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert, Card } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { deleteAccountAction } from "../actions";

const EMPTY: ActionState = {};

/**
 * Zrušení účtu.
 *
 * Potvrzení opsáním slova, ne zaškrtnutím. Zaškrtávátko se odklikne
 * omylem; opsat slovo vyžaduje pozornost, kterou nevratný krok zaslouží.
 *
 * Obrazovka vyjmenovává jménem, co konkrétně zmizí. Obecné „všechna data
 * budou smazána" si nikdo nespojí s tím, že přijde o Kubovy projekty.
 */
export function DeleteAccountForm({
  reason,
  childNames,
  email,
  isSelfManaged,
}: {
  reason?: string;
  childNames: string[];
  email: string;
  /** U samostatného účtu se nemluví o „profilech dětí". */
  isSelfManaged?: boolean;
}) {
  const [state, submit, pending] = useActionState(deleteAccountAction, EMPTY);

  return (
    <div className="flex flex-col gap-5">
      {reason && <Alert tone="warning">{reason}</Alert>}
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Card className="p-5">
        <h2 className="mb-3 font-semibold text-ink">Co se smaže</h2>

        <ul className="mb-4 flex flex-col gap-2 text-sm text-ink-500">
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>
              {isSelfManaged ? "Účet" : "Účet rodiče"}{" "}
              <span className="font-mono">{email}</span>
            </span>
          </li>
          {childNames.length > 0 && (
            <li className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>
                {isSelfManaged
                  ? "Tvůj profil "
                  : childNames.length === 1
                    ? "Profil "
                    : "Profily "}
                <strong className="text-ink">{childNames.join(", ")}</strong> včetně postupu
                v lekcích
              </span>
            </li>
          )}
          <li className="flex gap-2">
            <span aria-hidden="true">·</span>
            <span>Všechny uložené projekty — zapojení obvodů i 3D modely</span>
          </li>
        </ul>

        <p className="text-sm leading-relaxed text-ink-500">
          Smazání je okamžité a nevratné. Projekty si před ním{" "}
          {isSelfManaged ? "můžeš stáhnout ve svém profilu" : "můžete stáhnout v profilu dítěte"}.
        </p>
      </Card>

      <form action={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Pro potvrzení opište slovo SMAZAT"
          name="potvrzeni"
          required
          autoComplete="off"
          mono
          placeholder="SMAZAT"
          error={state.fieldErrors?.potvrzeni}
        />

        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="danger" loading={pending}>
            Nevratně zrušit účet
          </Button>

          {/* Cesta zpět je stejně viditelná jako cesta vpřed. Formulář,
              ze kterého se dá jen ven potvrzením, je nátlak. */}
          <Link
            href="/ucet"
            className="inline-flex min-h-12 items-center rounded-md border border-ink px-6 py-3
                       font-semibold text-ink transition-colors hover:bg-ink hover:text-paper"
          >
            Nechat účet být
          </Link>
        </div>
      </form>
    </div>
  );
}
