"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { setActiveChildAvatarAction } from "../actions";
import { AVATARS, Avatar } from "../avatars";

const EMPTY: ActionState = {};

/**
 * Mřížka avatarů. Každý avatar je submit tlačítko — jedno klepnutí uloží
 * a vrátí do lobby. Aktuální je vyznačený `aria-pressed`.
 */
export function AvatarPicker({ current }: { current: string }) {
  const [state, submit, pending] = useActionState(setActiveChildAvatarAction, EMPTY);

  return (
    <form action={submit} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {AVATARS.map((a) => {
          const selected = a.id === current;
          return (
            <button
              key={a.id}
              type="submit"
              name="avatar"
              value={a.id}
              disabled={pending}
              aria-pressed={selected}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors disabled:opacity-60 ${
                selected
                  ? "border-accent-500 bg-accent-50"
                  : "border-ink/15 bg-white hover:border-ink/40"
              }`}
            >
              <Avatar id={a.id} className="block size-16 text-ink" />
              <span className="text-sm font-medium text-ink">{a.label}</span>
            </button>
          );
        })}
      </div>
    </form>
  );
}
