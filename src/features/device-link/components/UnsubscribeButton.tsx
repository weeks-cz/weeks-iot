"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { unsubscribeDeviceLink } from "../link-actions";

const EMPTY: ActionState = {};

/**
 * Odhlášení je akce, ne odkaz: GET stránka nic nemění (e-mailové klienty
 * a skenery odkazy předem otevírají), změnu provede až tlačítko.
 */
export function UnsubscribeButton({ token }: { token: string }) {
  const [state, submit, pending] = useActionState(unsubscribeDeviceLink, EMPTY);

  if (state.success) {
    return <Alert tone="success">{state.success}</Alert>;
  }

  return (
    <form action={submit} className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="t" value={token} />
      <div>
        <Button type="submit" loading={pending}>
          Odhlásit
        </Button>
      </div>
    </form>
  );
}
