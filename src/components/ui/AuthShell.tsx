import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { MonoLabel } from "./Surface";

/**
 * Rámec pro přihlašovací a registrační obrazovky.
 *
 * Střízlivá tvář design systému. Rodič tady dává souhlas a později platí
 * kartou — má to působit jako nástroj, ne jako hra. Hravost patří do
 * dětské zóny.
 */
export function AuthShell({
  eyebrow,
  title,
  lead,
  children,
  aside,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  /** Obsah pod kartou — odkazy na jiné cesty dovnitř. */
  aside?: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-paper blueprint-grid">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10 sm:px-6">
        <header className="mb-6">
          <Logo className="mb-8" />
          {eyebrow && <MonoLabel className="mb-3">{eyebrow}</MonoLabel>}
          <h1 className="heading-2 text-ink">{title}</h1>
          {lead && <p className="mt-3 text-base leading-relaxed text-ink-500">{lead}</p>}
        </header>

        <div className="card-maker p-5 sm:p-6">{children}</div>

        {aside && <div className="mt-6 text-sm text-ink-500">{aside}</div>}
      </div>
    </main>
  );
}
