"use client";

import { useActionState, useEffect } from "react";
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

  /* Token drží skryté pole formuláře; z adresního řádku (historie, odkazující
     stránka při kliku ven) ho po vykreslení odstraníme. */
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("t")) return;
    url.searchParams.delete("t");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

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
