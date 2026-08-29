import type { SVGProps } from "react";

/**
 * Avatary jako linková kresba.
 *
 * Emoji vypadají na každém systému jinak — na Windows jiná sada než na
 * telefonu, na Linuxu občas prázdný obdélník — a k technickému výkresu
 * maker labu se nehodí vůbec. Tohle je inline SVG: škáluje se do libovolné
 * velikosti, drží barvy design systému a nevisí na tom, co má uživatel
 * nainstalované.
 *
 * Styl: tah 1,5 px, zaoblené konce, `currentColor` na konstrukci
 * a barevný akcent na to, co dělá avatar avatarem.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Frame({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const ACCENT = "var(--color-cta-500)";

function Robot(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M16 4v4" />
      <circle cx="16" cy="3" r="1.5" fill={ACCENT} stroke="none" />
      <rect x="6" y="8" width="20" height="16" rx="3" />
      <circle cx="12" cy="15" r="1.8" fill={ACCENT} stroke="none" />
      <circle cx="20" cy="15" r="1.8" fill={ACCENT} stroke="none" />
      <path d="M12.5 19.5h7" />
      <path d="M6 13H3.5M26 13H28.5" />
    </Frame>
  );
}

function Rocket(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M16 3c3.5 3.2 5.5 7.6 5.5 12.4V21h-11v-5.6C10.5 10.6 12.5 6.2 16 3Z" />
      <circle cx="16" cy="13" r="2.6" fill={ACCENT} stroke="none" />
      <path d="M10.5 17 6 21.5V25l4.5-2.5M21.5 17 26 21.5V25l-4.5-2.5" />
      <path d="M13.5 24.5 16 29l2.5-4.5" stroke={ACCENT} />
    </Frame>
  );
}

function Bolt(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M18 3 7 18h7l-2 11 11-15h-7l2-11Z" stroke={ACCENT} />
      <path d="M4 8h3M25 24h3M5 26h2" />
    </Frame>
  );
}

function Bulb(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M16 4a8 8 0 0 0-4.6 14.6c.9.7 1.6 1.9 1.6 3.1V23h6v-1.3c0-1.2.7-2.4 1.6-3.1A8 8 0 0 0 16 4Z" />
      <path d="M13 26h6M14 29h4" />
      <path d="M13.5 14.5 16 17l2.5-4" stroke={ACCENT} />
    </Frame>
  );
}

function Gear(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M16 3.5 18 7h4l1 4 3.2 2.2-1.4 3.8 1.4 3.8L23 23l-1 4h-4l-2 3.5L14 27h-4l-1-4-3.2-2.2 1.4-3.8-1.4-3.8L9 11l1-4h4l2-3.5Z" />
      <circle cx="16" cy="16" r="4.5" stroke={ACCENT} />
    </Frame>
  );
}

function Microscope(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M13 4h5l1.5 9h-8L13 4Z" stroke={ACCENT} />
      <path d="M11.5 13h9l-1 4h-7l-1-4Z" />
      <path d="M16 17v4" />
      <path d="M9 25h14M6 28h20" />
      <path d="M20 21c3.5 0 6 2 6 4" />
    </Frame>
  );
}

function Circuit(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="25" cy="7" r="2.5" />
      <circle cx="7" cy="25" r="2.5" />
      <circle cx="25" cy="25" r="2.5" fill={ACCENT} stroke={ACCENT} />
      <path d="M9.5 7h13M7 9.5v13M9.5 25h13M25 9.5v13" />
      <rect x="12.5" y="12.5" width="7" height="7" rx="1.5" stroke={ACCENT} />
    </Frame>
  );
}

function Planet(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="16" cy="15" r="8" />
      <path d="M4.5 20c4 3.2 19.5 3.2 23.5 0" stroke={ACCENT} />
      <path d="M12 12.5c2.5-1.5 6-1 8 1" />
      <circle cx="27" cy="6" r="1.3" fill={ACCENT} stroke="none" />
      <circle cx="5" cy="9" r="1" fill={ACCENT} stroke="none" />
    </Frame>
  );
}

export const AVATARS = [
  { id: "robot", label: "Robot", Icon: Robot },
  { id: "raketa", label: "Raketa", Icon: Rocket },
  { id: "blesk", label: "Blesk", Icon: Bolt },
  { id: "zarovka", label: "Žárovka", Icon: Bulb },
  { id: "ozubene-kolo", label: "Ozubené kolo", Icon: Gear },
  { id: "mikroskop", label: "Mikroskop", Icon: Microscope },
  { id: "obvod", label: "Obvod", Icon: Circuit },
  { id: "planeta", label: "Planeta", Icon: Planet },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

const BY_ID = new Map(AVATARS.map((a) => [a.id as string, a]));

export function avatarLabel(id: string): string {
  return BY_ID.get(id)?.label ?? "Robot";
}

/**
 * Vykreslení avatara.
 *
 * Neznámé id spadne na robota — profil založený dřív, než přibyl nový
 * avatar, tak nezmizí a nevykreslí prázdno.
 */
export function Avatar({
  id,
  className,
  title,
}: {
  id: string;
  className?: string;
  /** Když je jméno vedle, nech prázdné — jinak to čtečka přečte dvakrát. */
  title?: string;
}) {
  const entry = BY_ID.get(id) ?? BY_ID.get("robot")!;
  const { Icon } = entry;

  return (
    <span
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <Icon className="size-full" />
    </span>
  );
}
