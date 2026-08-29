"use client";

import { useActionState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import type { ActionState } from "@/features/actions";
import { switchChildAction } from "../actions";

const EMPTY: ActionState = {};

/**
 * „Pokračovat" u profilu v rodičovské zóně.
 *
 * Bez PINu přepne rovnou — cookii nastavuje `switchChildAction`, což je
 * Server Action, a ta cookies měnit smí (Server Componenta ne, na tom
 * tahle cesta předtím padala).
 *
 * S PINem vede na výběr profilu s předvyplněným `?dite=`, kde se otevře
 * pole na PIN. Mezikrok „vyber si profil" u někoho, kdo právě na profil
 * klikl, by nedával smysl.
 */
export function ContinueButton({
  childId,
  hasPin,
  isLocked,
}: {
  childId: string;
  hasPin: boolean;
  isLocked: boolean;
}) {
  const [state, submit, pending] = useActionState(switchChildAction, EMPTY);

  if (isLocked) {
    return (
      <ButtonLink href="/ucet/deti" size="sm" variant="outline" fullWidth>
        Odemknout profil
      </ButtonLink>
    );
  }

  if (hasPin) {
    return (
      <ButtonLink href={`/ucim-se/prepnout?dite=${childId}`} size="sm" fullWidth>
        Pokračovat
      </ButtonLink>
    );
  }

  return (
    <form action={submit}>
      <input type="hidden" name="childId" value={childId} />
      <input type="hidden" name="pin" value="" />
      <Button type="submit" size="sm" fullWidth loading={pending}>
        Pokračovat
      </Button>
      {state.error && (
        <p role="alert" className="mt-2 text-xs text-danger-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
