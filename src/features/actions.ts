/**
 * Sdílený tvar výsledku server action.
 *
 * Žije mimo soubory s "use server" schválně: ty smí exportovat jen async
 * funkce. Typy se sice při překladu vymažou, ale kontrola Next.js se dívá
 * na zdroj, ne na výstup.
 */
export interface ActionState {
  /** Chyba, která se týká celého formuláře. */
  error?: string;
  /** Chyby navázané na konkrétní pole. Klíč je jeho `name`. */
  fieldErrors?: Record<string, string>;
  /** Potvrzení úspěchu, když se nikam nepřesměrovává. */
  success?: string;
}

/** Převod chyb ze Zodu na mapu pole → hláška. První chyba na pole vyhrává. */
export function fieldErrorsFrom(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
