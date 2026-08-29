"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { Alert, Badge, Card, MonoLabel } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { birthYearRange } from "@/features/onboarding/schema";
import {
  archiveChildAction,
  createChildAction,
  setChildPinAction,
  unlockChildAction,
} from "../actions";
import { AVATARS, avatarGlyph } from "../avatars";
import type { ChildSummary } from "../queries";

const EMPTY: ActionState = {};

function YearSelect({ defaultValue, error }: { defaultValue?: number; error?: string }) {
  const { min, max } = birthYearRange();
  const years = Array.from({ length: max - min + 1 }, (_, i) => max - i);

  return (
    <SelectField
      label="Rok narození"
      name="birthYear"
      required
      mono
      defaultValue={defaultValue ?? ""}
      error={error}
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
  );
}

/* ── Přidání dítěte ────────────────────────────────────────────────────── */

function AddChildForm() {
  const [state, submit, pending] = useActionState(createChildAction, EMPTY);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        Přidat další dítě
      </Button>
    );
  }

  return (
    <Card className="p-5">
      <h2 className="heading-3 mb-4">Nový profil</h2>

      {state.error && (
        <div className="mb-4">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}
      {state.success && (
        <div className="mb-4">
          <Alert tone="success">{state.success}</Alert>
        </div>
      )}

      <form action={submit} className="flex flex-col gap-4" noValidate>
        <TextField
          label="Přezdívka"
          name="nick"
          required
          maxLength={24}
          autoComplete="off"
          error={state.fieldErrors?.nick}
        />

        <YearSelect error={state.fieldErrors?.birthYear} />

        <div>
          <MonoLabel className="mb-2">Avatar</MonoLabel>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((avatar, index) => (
              <label
                key={avatar.id}
                className="cursor-pointer rounded-md border border-ink/15 bg-white p-3
                           transition-colors hover:border-ink
                           has-[:checked]:border-ink has-[:checked]:bg-primary-50
                           has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2
                           has-[:focus-visible]:outline-ink"
              >
                <input
                  type="radio"
                  name="avatar"
                  value={avatar.id}
                  defaultChecked={index === 0}
                  className="sr-only"
                />
                <span className="text-2xl" aria-hidden="true">
                  {avatar.glyph}
                </span>
                <span className="sr-only">{avatar.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" loading={pending}>
            Vytvořit profil
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Zrušit
          </Button>
        </div>
      </form>
    </Card>
  );
}

/* ── PIN ───────────────────────────────────────────────────────────────── */

function PinForm({ child }: { child: ChildSummary }) {
  const [state, submit, pending] = useActionState(setChildPinAction, EMPTY);
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      {state.success && (
        <div className="mb-3">
          <Alert tone="success">{state.success}</Alert>
        </div>
      )}
      {state.error && (
        <div className="mb-3">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}

      {!open ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-500">
            {child.hasPin
              ? "Profil je chráněný PINem."
              : "Bez PINu. Profil se přepne jedním kliknutím."}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            {child.hasPin ? "Změnit PIN" : "Nastavit PIN"}
          </Button>
        </div>
      ) : (
        <form action={submit} className="flex flex-col gap-3" noValidate>
          <input type="hidden" name="childId" value={child.id} />

          <TextField
            label="Nový PIN"
            name="pin"
            /* text + inputMode numeric místo type="number": číselné pole
               ukazuje šipky, jde v něm rolovat myší a Firefox v něm pustí
               i "e" a "-". Na PIN se nehodí. */
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            autoComplete="off"
            mono
            hint="Čtyři číslice. Prázdné pole PIN zruší."
            error={state.fieldErrors?.pin}
          />

          <div className="flex gap-3">
            <Button type="submit" size="sm" loading={pending}>
              Uložit
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function UnlockForm({ childId }: { childId: string }) {
  const [state, submit, pending] = useActionState(unlockChildAction, EMPTY);

  return (
    <form action={submit} className="mt-3">
      <input type="hidden" name="childId" value={childId} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        Odemknout profil
      </Button>
    </form>
  );
}

function ArchiveForm({ child }: { child: ChildSummary }) {
  const [state, submit, pending] = useActionState(archiveChildAction, EMPTY);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Skrýt profil
      </Button>
    );
  }

  return (
    <form action={submit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="childId" value={child.id} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <p className="text-sm text-ink-500">
        Skrýt profil {child.nick}? Postup zůstane uložený.
      </p>
      <Button type="submit" size="sm" variant="danger" loading={pending}>
        Skrýt
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
        Ne
      </Button>
    </form>
  );
}

/* ── Přehled ───────────────────────────────────────────────────────────── */

export function ChildManager({ children }: { children: ChildSummary[] }) {
  return (
    <div className="flex flex-col gap-5">
      {children.map((child) => (
        <Card key={child.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                {avatarGlyph(child.avatar)}
              </span>
              <div>
                <h2 className="heading-3 text-ink">{child.nick}</h2>
                <p className="font-mono text-xs text-ink-500">
                  ročník {child.birth_year} · dokončeno {child.lessonsCompleted} lekcí
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {child.isLocked && <Badge tone="danger">zamčeno</Badge>}
              <ArchiveForm child={child} />
            </div>
          </div>

          {child.isLocked && <UnlockForm childId={child.id} />}
          <PinForm child={child} />
        </Card>
      ))}

      <AddChildForm />
    </div>
  );
}
