import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Tlačítko.
 *
 * Tvrdý stín a posun o dva pixely na hover je podpis maker labu — vypadá
 * to jako razítko na technickém výkresu, ne jako materiálový stín.
 *
 * Amber je vyhrazená jediné věci: hlavní akci na obrazovce. Když jsou na
 * stránce dvě amber tlačítka, jedno z nich je špatně.
 */

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-md " +
  "transition-all duration-200 select-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
  "disabled:opacity-50 disabled:pointer-events-none";

/* Posun a stín se dávají jen tam, kde nejsou disabled — jinak se prvek
   hýbe, i když nic neudělá. */
const LIFT = "hover:shadow-hard hover:-translate-y-0.5 hover:-translate-x-0.5";

const VARIANTS: Record<Variant, string> = {
  primary: cn("bg-cta-500 hover:bg-cta-400 text-ink border border-ink shadow-hard-sm", LIFT),
  secondary: cn("bg-ink hover:bg-ink-700 text-paper border border-ink", LIFT),
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  ghost: "text-ink-500 hover:text-ink hover:bg-paper-soft border border-transparent",
  danger: cn("bg-danger-600 hover:bg-danger-500 text-white border border-danger-700", LIFT),
};

const SIZES: Record<Size, string> = {
  /* min-h drží dotykový cíl na 44 px i u malé varianty. Pod tím se na
     telefonu trefuje špatně a je to jeden z nejčastějších důvodů, proč
     formulář na mobilu „nefunguje". */
  sm: "text-sm px-3.5 py-2 min-h-11",
  md: "text-base px-6 py-3 min-h-12",
  lg: "text-lg px-8 py-4 min-h-14",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
  className?: string;
}

function classes({ variant = "primary", size = "md", fullWidth, className }: CommonProps) {
  return cn(BASE, VARIANTS[variant], SIZES[size], fullWidth && "w-full", className);
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}

type ButtonProps = CommonProps & Omit<ComponentProps<"button">, "children" | "className">;

export function Button({
  variant,
  size,
  fullWidth,
  loading,
  children,
  className,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      /* aria-busy říká čtečce, že se pracuje. Bez toho uživatel slyší jen
         to, že tlačítko přestalo reagovat. */
      aria-busy={loading || undefined}
      className={classes({ variant, size, fullWidth, className, children })}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & Omit<ComponentProps<typeof Link>, "children" | "className">;

export function ButtonLink({
  variant,
  size,
  fullWidth,
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, fullWidth, className, children })} {...rest}>
      {children}
    </Link>
  );
}
