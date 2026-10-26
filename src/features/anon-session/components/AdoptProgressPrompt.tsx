"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert, Card, MonoLabel } from "@/components/ui/Surface";
import { Avatar } from "@/features/children/avatars";
import type { ActionState } from "@/features/actions";
import { adoptAnonProgressAction } from "../actions";
import { countAnonLessons } from "../parse";
import { clearAnonBuilds, useAnonBuildsRaw } from "@/features/collection/anon-builds";
import { clearAnonSession } from "../storage";
import { useAnonSession, useAnonSessionRaw } from "../useAnonSession";

const EMPTY: ActionState = {};

export interface AdoptableChild {
  id: string;
  nick: string;
  avatar: string;
}

/**
 * Nabídka převzít rozdělané lekce z tohohle počítače.
 *
 * Objeví se jen tehdy, když prohlížeč nese anonymní postup a přihlášený
 * rodič má aspoň jedno dítě. Nikdy se nepřevádí automaticky: „Převzít“
 * zapíše postup do profilu a teprve potom se smaže z prohlížeče; „Ne“
 * smaže postup hned — rodič to tak chtěl.
 */
export function AdoptProgressPrompt({
  profiles,
  activeChildId,
}: {
  profiles: AdoptableChild[];
  activeChildId: string | null;
}) {
  const session = useAnonSession();
  const raw = useAnonSessionRaw();
  const rawBuilds = useAnonBuildsRaw();
  const [dismissed, setDismissed] = useState(false);
  const [state, submit, pending] = useActionState(adoptAnonProgressAction, EMPTY);
  const [childId, setChildId] = useState(activeChildId ?? profiles[0]?.id ?? "");

  /* Smaže se až po potvrzeném zápisu do účtu, ne dřív — jinak by při chybě
     dítě o postup přišlo. */
  useEffect(() => {
    if (state.success) {
      clearAnonSession();
      clearAnonBuilds();
    }
  }, [state.success]);

  if (dismissed || profiles.length === 0 || !session) return null;

  const lessons = countAnonLessons(session);
  if (lessons === 0) return null;

  const chosen = profiles.find((c) => c.id === childId) ?? profiles[0]!;

  if (state.success) {
    return (
      <Alert tone="success" title="Rozdělané lekce jsou v profilu">
        {state.success} Na tomhle počítači už nezůstávají.
      </Alert>
    );
  }

  return (
    <Card className="p-5">
      <MonoLabel className="mb-2">Rozdělané lekce</MonoLabel>
      <h2 className="heading-3 mb-2 text-ink">
        Na tomhle počítači jsou rozdělané lekce ({lessons}).
      </h2>
      <p className="mb-4 text-sm text-ink-500">
        Převzít je do profilu {chosen.nick}?
      </p>

      {state.error && (
        <div className="mb-4">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}

      <form action={submit} className="flex flex-col gap-4">
        <input type="hidden" name="anonSession" value={raw} />
        <input type="hidden" name="anonBuilds" value={rawBuilds} />

        {profiles.length > 1 && (
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-sm font-semibold text-ink">Komu postup patří</legend>
            {profiles.map((child) => (
              <label
                key={child.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border
                           border-ink/15 bg-white px-3 py-2 transition-colors hover:border-ink
                           has-[:checked]:border-ink has-[:checked]:bg-primary-50
                           has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
                           has-[:focus-visible]:outline-ink"
              >
                <input
                  type="radio"
                  name="childId"
                  value={child.id}
                  checked={childId === child.id}
                  onChange={() => setChildId(child.id)}
                  className="size-4 accent-primary-600"
                />
                <Avatar id={child.avatar} className="block size-6 text-ink" />
                <span className="text-sm text-ink">{child.nick}</span>
              </label>
            ))}
          </fieldset>
        )}

        {profiles.length === 1 && <input type="hidden" name="childId" value={chosen.id} />}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending}>
            Převzít
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              clearAnonSession();
              clearAnonBuilds();
              setDismissed(true);
            }}
          >
            Ne
          </Button>
        </div>
      </form>
    </Card>
  );
}
