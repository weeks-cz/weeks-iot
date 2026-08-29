"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { joinCityWaitlistAction } from "../actions";

const EMPTY: ActionState = {};

export function CityWaitlistForm() {
  const [state, submit, pending] = useActionState(joinCityWaitlistAction, EMPTY);

  if (state.success) {
    return <Alert tone="success">{state.success}</Alert>;
  }

  return (
    <form action={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
      <TextField
        label="Vaše město"
        name="city"
        required
        autoComplete="address-level2"
        maxLength={80}
        error={state.fieldErrors?.city}
        className="flex-1"
      />

      {/* sm:mt-7 srovná tlačítko s polem — label nad inputem zabírá řádek,
          který u tlačítka není. */}
      <Button type="submit" loading={pending} className="sm:mt-7">
        Přidat město
      </Button>

      {state.error && (
        <div className="sm:w-full">
          <Alert tone="danger">{state.error}</Alert>
        </div>
      )}
    </form>
  );
}
