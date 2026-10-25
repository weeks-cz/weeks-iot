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
  /* Výměna kódu selhala, ale důvod nemusí být špatný odkaz: adresa bývá
     potvrzená a odkaz otevřený v jiném prohlížeči nebo znovu. */
  potvrzeni:
    "Pokud jste e-mail už potvrdili, přihlaste se níže heslem. " +
    "Pokud ne, otevřete odkaz z e-mailu znovu ve stejném prohlížeči, kde jste se registrovali.",
};

/** Hláška pro `?potvrzeno=1` — posílá ji `/auth/confirm` po potvrzení adresy. */
export const CONFIRMED_MESSAGE = "E-mail je potvrzený. Přihlaste se prosím heslem, které jste si zvolili.";

export function loginErrorMessage(code: string | undefined): string | undefined {
  if (!code || !Object.hasOwn(LOGIN_ERRORS, code)) return undefined;
  return LOGIN_ERRORS[code];
}
