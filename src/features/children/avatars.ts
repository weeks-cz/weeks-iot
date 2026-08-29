/**
 * Avatary.
 *
 * Samostatný modul bez jediného serverového importu — a to schválně.
 * Když tohle žilo v `queries.ts`, stačilo, aby si klientská komponenta
 * vyžádala `avatarGlyph`, a bundler do prohlížeče přitáhl celý serverový
 * Supabase klient včetně `next/headers`. Build to zachytil, ale pravidlo
 * je obecné: čisté pomocné funkce nepatří vedle přístupu k databázi.
 */

export const AVATARS = [
  { id: "robot", label: "Robot", glyph: "🤖" },
  { id: "raketa", label: "Raketa", glyph: "🚀" },
  { id: "blesk", label: "Blesk", glyph: "⚡" },
  { id: "zarovka", label: "Žárovka", glyph: "💡" },
  { id: "ozubene-kolo", label: "Ozubené kolo", glyph: "⚙️" },
  { id: "mikroskop", label: "Mikroskop", glyph: "🔬" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];

const GLYPH_BY_ID = new Map<string, string>(AVATARS.map((a) => [a.id, a.glyph]));

export function avatarGlyph(avatar: string): string {
  return GLYPH_BY_ID.get(avatar) ?? "🤖";
}
