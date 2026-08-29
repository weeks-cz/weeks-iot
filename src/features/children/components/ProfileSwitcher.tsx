"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert, Card } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { switchChildAction } from "../actions";
import { avatarGlyph } from "../avatars";
import type { ChildSummary } from "../queries";

const EMPTY: ActionState = {};

/**
 * Výběr profilu.
 *
 * Dětská tvář design systému: velké dotykové cíle, výrazný avatar,
 * vzdušné rozestupy. Bez PINu je to jeden klik — PIN se ptá až tehdy,
 * když ho profil má.
 */
export function ProfileSwitcher({ profiles }: { profiles: ChildSummary[] }) {
  const [state, submit, pending] = useActionState(switchChildAction, EMPTY);
  const [selected, setSelected] = useState<ChildSummary | null>(null);

  /* Profil s PINem otevře dialog s polem. Bez PINu se odesílá rovnou —
     mezikrok „potvrďte výběr" by u dítěte nedával smysl. */
  if (selected?.hasPin) {
    return (
      <Card className="mx-auto max-w-sm p-6">
        <div className="mb-4 text-center">
          <span className="text-5xl" aria-hidden="true">
            {avatarGlyph(selected.avatar)}
          </span>
          <h2 className="heading-3 mt-2">{selected.nick}</h2>
        </div>

        {state.error && (
          <div className="mb-4">
            <Alert tone="danger">{state.error}</Alert>
          </div>
        )}

        <form action={submit} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="childId" value={selected.id} />

          <TextField
            label="Zadej svůj PIN"
            name="pin"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            autoFocus
            mono
            error={state.fieldErrors?.pin}
          />

          <Button type="submit" fullWidth loading={pending}>
            Pokračovat
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
            Zpět na výběr
          </Button>
        </form>
      </Card>
    );
  }

  return (
    <div>
      {state.error && (
        <div className="mb-4">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((child) => (
          <li key={child.id}>
            {child.hasPin ? (
              <button
                type="button"
                onClick={() => setSelected(child)}
                className="card-maker card-maker-hover flex w-full flex-col items-center gap-2 p-6
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="text-5xl" aria-hidden="true">
                  {avatarGlyph(child.avatar)}
                </span>
                <span className="heading-3 text-ink">{child.nick}</span>
                <span className="mono-label">chráněno pinem</span>
              </button>
            ) : (
              <form action={submit}>
                <input type="hidden" name="childId" value={child.id} />
                <input type="hidden" name="pin" value="" />
                <button
                  type="submit"
                  className="card-maker card-maker-hover flex w-full flex-col items-center gap-2 p-6
                             focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <span className="text-5xl" aria-hidden="true">
                    {avatarGlyph(child.avatar)}
                  </span>
                  <span className="heading-3 text-ink">{child.nick}</span>
                  <span className="mono-label">
                    {child.lessonsCompleted > 0
                      ? `${child.lessonsCompleted} hotových lekcí`
                      : "začni první lekcí"}
                  </span>
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
