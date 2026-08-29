"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Formulářová pole.
 *
 * Přístupnost tady není doplněk, ale důvod, proč komponenty existují:
 * label svázaný přes for/id, chyba navázaná přes aria-describedby
 * a aria-invalid, hlášení chyby v aria-live. Ručně psané <input> tohle
 * vynechává skoro vždycky.
 */

const INPUT_BASE =
  "w-full rounded-md bg-white border text-ink placeholder:text-ink/40 " +
  "px-3.5 py-3 min-h-12 text-base " +
  "transition-colors outline-none " +
  "focus:border-ink focus:ring-1 focus:ring-ink " +
  "disabled:bg-paper-soft disabled:text-ink-300";

const INPUT_OK = "border-ink/20";
const INPUT_ERROR = "border-danger-500 ring-1 ring-danger-500";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, hint, error, required, children, className }: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="ml-1 text-danger-600" aria-hidden="true">
            *
          </span>
        )}
        {!required && <span className="ml-2 font-normal text-ink-300">nepovinné</span>}
      </label>

      {hint && (
        <p id={`${id}-hint`} className="text-sm text-ink-500">
          {hint}
        </p>
      )}

      {children}

      {/* Prázdný živý region existuje od začátku schválně: čtečka oznámí
          jen text, který do už existujícího regionu přibude. Kdyby se
          region teprve vytvářel spolu s chybou, část čteček ji přeskočí. */}
      <p
        id={`${id}-error`}
        role="alert"
        aria-live="polite"
        className={cn("text-sm font-medium text-danger-600", !error && "sr-only")}
      >
        {error ?? ""}
      </p>
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const parts = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
}

/* ── Text ──────────────────────────────────────────────────────────────── */

type TextFieldProps = Omit<ComponentProps<"input">, "id" | "className"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Mono na e-maily, čísla a kódy — čísla jsou pak jednoznačná. */
  mono?: boolean;
  className?: string;
};

export function TextField({
  label,
  hint,
  error,
  mono,
  required,
  className,
  ...rest
}: TextFieldProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(INPUT_BASE, error ? INPUT_ERROR : INPUT_OK, mono && "font-mono")}
        {...rest}
      />
    </FieldShell>
  );
}

/* ── Select ────────────────────────────────────────────────────────────── */

type SelectFieldProps = Omit<ComponentProps<"select">, "id" | "className"> & {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Mono na roky a číselné hodnoty — číslice jsou pak stejně široké. */
  mono?: boolean;
  className?: string;
};

export function SelectField({
  label,
  hint,
  error,
  mono,
  required,
  children,
  className,
  ...rest
}: SelectFieldProps) {
  const id = useId();

  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <select
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(
          INPUT_BASE,
          error ? INPUT_ERROR : INPUT_OK,
          "appearance-none pr-10",
          mono && "font-mono",
        )}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%234a4f6a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
          backgroundPosition: "right 0.75rem center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "1.25rem",
        }}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/* ── Checkbox ──────────────────────────────────────────────────────────── */

type CheckboxProps = Omit<ComponentProps<"input">, "id" | "type" | "className"> & {
  label: ReactNode;
  error?: string | null;
  /** Rozbalitelné plné znění — u souhlasů povinné. */
  details?: ReactNode;
  className?: string;
};

export function Checkbox({ label, error, details, required, className, ...rest }: CheckboxProps) {
  const id = useId();

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className={cn(
          "flex gap-3 rounded-md border bg-white p-3.5 transition-colors",
          error ? "border-danger-500" : "border-ink/15",
        )}
      >
        <input
          id={id}
          type="checkbox"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          /* mt-0.5 zarovná zaškrtávátko na první řádek víceřádkového textu.
             items-center by ho u dlouhého souhlasu odsunulo doprostřed. */
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm border-ink/30 accent-primary-600"
          {...rest}
        />
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="cursor-pointer text-sm leading-relaxed text-ink">
            {label}
            {required && (
              <span className="ml-1 text-danger-600" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {details}
        </div>
      </div>

      <p
        id={`${id}-error`}
        role="alert"
        aria-live="polite"
        className={cn("text-sm font-medium text-danger-600", !error && "sr-only")}
      >
        {error ?? ""}
      </p>
    </div>
  );
}
