/**
 * Input + code-string normalization utilities.
 * Ported from legacy-vanilla/app.js lines 1711-1826 for parity with
 * STRICT_TASK_RULES (Task 18) which depends on exact normalization output.
 *
 * In React/JSX, escapeHtml is rarely needed (JSX escapes automatically) — kept
 * only for places that genuinely build raw HTML strings.
 */

export function escapeHtml(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeEmail(email: unknown): string {
  return String(email ?? "").trim().toLowerCase();
}

export function isValidEmail(email: unknown): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

export function buildNicknameFromEmail(email: unknown): string {
  const localPart = normalizeEmail(email).split("@")[0] ?? "";
  return (localPart || "student").slice(0, 20);
}

export function buildDateSeed(dateKey: string | null | undefined): number {
  return Array.from(String(dateKey ?? "")).reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
}

export function hasAll(text: string, patterns: string[]): boolean {
  return patterns.every((pattern) => text.includes(pattern));
}

export function hasAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

export function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length;
}

/**
 * Code normalizer used by STRICT_TASK_RULES. Order matters:
 *  1. strip block comments → space
 *  2. strip line comments → space
 *  3. collapse double-quoted strings to ""
 *  4. collapse single-quoted strings to ''
 *  5. lowercase
 *  6. collapse whitespace
 *  7. trim
 *
 * The string-stripping step prevents user-supplied string literals from
 * accidentally satisfying or breaking pattern matches.
 */
export function normalizeCodeForValidation(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
