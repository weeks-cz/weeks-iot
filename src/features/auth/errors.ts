/**
 * Hlášky pro `?chyba=` na přihlašovací stránce. Kódy posílá callback.
 *
 * Hledá se jen mezi vlastními klíči: obyčejný objekt dědí `constructor`,
 * `toString` a spol., a takový kód z URL by vrátil funkci místo textu.
 */
const LOGIN_ERRORS: Readonly<Record<string, string>> = {
  google: "Přihlášení přes Google se nepovedlo. Zkuste to prosím znovu nebo použijte e-mail.",
  callback: "Odkaz už není platný. Požádejte prosím o nový.",
  expired: "Odkaz vypršel. Požádejte prosím o nový.",
};

export function loginErrorMessage(code: string | undefined): string | undefined {
  if (!code || !Object.hasOwn(LOGIN_ERRORS, code)) return undefined;
  return LOGIN_ERRORS[code];
}
