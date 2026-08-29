"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert, Badge, Card } from "@/components/ui/Surface";
import type { ActionState } from "@/features/actions";
import { changeConsentAction } from "../actions";
import type { ConsentStatus } from "../logic";
import { consentTextFor } from "../texts";

const EMPTY: ActionState = {};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function ConsentList({ statuses }: { statuses: ConsentStatus[] }) {
  const [state, submit, pending] = useActionState(changeConsentAction, EMPTY);

  return (
    <div className="flex flex-col gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}

      {statuses.map((status) => {
        const text = consentTextFor(status.kind);

        return (
          <Card key={status.kind} className="p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 font-semibold text-ink">{status.label}</h2>
                <p className="font-mono text-xs text-ink-500">
                  {status.changedAt
                    ? `${status.granted ? "Uděleno" : "Odvoláno"} ${formatDate(status.changedAt)} · ${status.version}`
                    : "Zatím neuděleno"}
                </p>
              </div>

              {status.granted ? (
                <Badge tone="trust">platí</Badge>
              ) : (
                <Badge tone="neutral">neplatí</Badge>
              )}
            </div>

            {status.outdated && (
              <div className="mb-3">
                <Alert tone="warning">
                  Znění se od vašeho souhlasu změnilo. Prosím potvrďte nové.
                </Alert>
              </div>
            )}

            <details className="mb-4">
              <summary className="cursor-pointer text-sm text-primary-600 underline underline-offset-4">
                Zobrazit plné znění
              </summary>
              <div className="mt-2 max-h-72 overflow-y-auto rounded-sm bg-paper-soft p-3">
                <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-500">
                  {text.full}
                </pre>
              </div>
            </details>

            {/* Odvolání musí být stejně snadné jako udělení — jedno tlačítko,
                stejně viditelné, bez mezikroků. Čl. 7 odst. 3 GDPR. */}
            <form action={submit}>
              <input type="hidden" name="kind" value={status.kind} />
              <input type="hidden" name="granted" value={status.granted ? "false" : "true"} />

              <Button
                type="submit"
                size="sm"
                variant={status.granted ? "outline" : "primary"}
                loading={pending}
              >
                {status.granted ? "Odvolat souhlas" : "Udělit souhlas"}
              </Button>
            </form>

            {status.required && status.granted && (
              <p className="mt-3 text-xs leading-relaxed text-ink-500">
                {status.kind === "parental"
                  ? "Bez tohoto souhlasu nemáme právní základ zpracovávat údaje dítěte. Jeho odvolání proto znamená zrušení účtu — potvrdíte to v dalším kroku."
                  : "Bez potvrzení podmínek nelze účet provozovat. Odvolání znamená zrušení účtu."}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
