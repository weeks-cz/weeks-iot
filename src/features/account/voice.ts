import type { AccountType } from "@/lib/supabase/types";

/**
 * Jak aplikace oslovuje držitele účtu.
 *
 * Účet může patřit dvěma různým lidem — rodiči, který spravuje profil
 * dítěte, nebo uživateli od 15 let, který se učí sám. Datově je to totéž
 * (`parents` je držitel účtu, `children` učící se profil), ale mluvit se
 * na ně musí jinak. Patnáctiletý, který se učí sám, nemá vidět „Profily
 * dětí" a „Kdo se dneska učí?" — je tam jenom on.
 *
 * Všechny takové texty žijí tady, ne rozházené po komponentách. Kdyby se
 * podmínka `account_type === "self"` opakovala v deseti souborech, dřív
 * nebo později by se někde vynechala — a to je přesně ten druh chyby,
 * který nikdo nenahlásí, jen z toho má divný pocit.
 */

export interface AccountVoice {
  /** Vyká se rodiči, tyká tomu, kdo se učí sám. */
  formal: boolean;
  nav: { overview: string; profiles: string; consents: string };
  overviewHeading: string;
  profilesHeading: string;
  profilesLead: string;
  /** Smí přidat další profil? U samostatného účtu nedává smysl. */
  canAddProfiles: boolean;
  deleteIntro: string;
}

const GUARDIAN: AccountVoice = {
  formal: true,
  nav: { overview: "Přehled", profiles: "Profily dětí", consents: "Souhlasy" },
  overviewHeading: "Kdo se dneska učí?",
  profilesHeading: "Profily dětí",
  profilesLead:
    "Každé dítě má svůj postup a své projekty. PIN je nepovinný — hodí se, " +
    "když sourozenci sdílejí jeden počítač.",
  canAddProfiles: true,
  deleteIntro:
    "Zrušením smažeme profily dětí, jejich postup i uložené projekty. Je to nevratné.",
};

const SELF: AccountVoice = {
  formal: false,
  nav: { overview: "Přehled", profiles: "Můj profil", consents: "Souhlasy" },
  overviewHeading: "Pokračuj v učení",
  profilesHeading: "Můj profil",
  profilesLead:
    "Tvůj postup a tvoje projekty. PIN je nepovinný — hodí se, když počítač " +
    "sdílíš s někým dalším.",
  canAddProfiles: false,
  deleteIntro: "Zrušením smažeme tvůj postup i uložené projekty. Je to nevratné.",
};

export function voiceFor(accountType: AccountType | null | undefined): AccountVoice {
  /* Neznámý typ se chová jako rodičovský — vykání a opatrnější formulace
     nikoho neurazí, opačná volba by tykala rodiči. */
  return accountType === "self" ? SELF : GUARDIAN;
}
