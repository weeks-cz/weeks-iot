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
  "focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none";

/* Barva fokusu podle pozadí: inkoustový kroužek na tmavé ploše zmizí. */
const FOCUS = "focus-visible:outline-ink";
const FOCUS_ON_DARK = "focus-visible:outline-paper";

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

/* Obrysové tlačítko na tmavém pozadí (`onDark`). Ostatní varianty se
   na tmě nemění — amber a ink mají vlastní rámeček. */
const OUTLINE_ON_DARK =
  "border border-paper/50 text-paper hover:border-paper hover:bg-paper hover:text-ink";

const SIZES: Record<Size, string> = {
  /* min-h drží dotykový cíl na 44 px i u malé varianty. Pod tím se na
     telefonu trefuje špatně a je to jeden z nejčastějších důvodů, proč
     formulář na mobilu „nefunguje". */
  sm: "text-sm px-3.5 py-2 min-h-11",
  md: "text-base px-6 py-3 min-h-12",
  lg: "text-lg px-8 py-4 min-h-14",
};

export interface ButtonStyle {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  /** Tlačítko stojí na tmavém pozadí: světlý kroužek fokusu, obrys v papíru. */
  onDark?: boolean;
  className?: string;
}

interface CommonProps extends ButtonStyle {
  loading?: boolean;
  children: ReactNode;
}

/**
 * Třídy tlačítka pro prvek, který nemůže být `Button` ani `ButtonLink` —
 * např. obyčejné `<a>` na soubor, které `next/link` nesmí přednačítat.
 */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth,
  onDark = false,
  className,
}: ButtonStyle = {}): string {
  return cn(
    BASE,
    onDark ? FOCUS_ON_DARK : FOCUS,
    onDark && variant === "outline" ? OUTLINE_ON_DARK : VARIANTS[variant],
    SIZES[size],
    fullWidth && "w-full",
    className,
  );
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
  onDark,
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
      className={buttonClasses({ variant, size, fullWidth, onDark, className })}
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
  onDark,
  children,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, fullWidth, onDark, className })} {...rest}>
      {children}
    </Link>
  );
}
