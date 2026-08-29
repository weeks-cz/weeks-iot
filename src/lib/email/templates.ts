import type { EmailContent } from "./layout";

/**
 * Znění transakčních e-mailů.
 *
 * Tón: mluvíme k rodiči, ne k dítěti. Krátce, česky, bez vykřičníků
 * a bez marketingu — tyhle e-maily chodí nezávisle na souhlasu s obchodními
 * sděleními, takže do nich nabídky nepatří.
 *
 * Každý e-mail, který něco potvrzuje, musí říct i to, co dělat, když ho
 * člověk nečekal. Bez té věty vypadá zpráva o změně hesla jako útok.
 */

export interface EmailTemplate {
  subject: string;
  content: EmailContent;
}

export function confirmSignupEmail(url: string): EmailTemplate {
  return {
    subject: "Potvrďte svou e-mailovou adresu",
    content: {
      preheader: "Jeden klik a účet v učebně je hotový.",
      heading: "Potvrďte svou e-mailovou adresu",
      paragraphs: [
        "Vítejte v učebně Weeks. Ještě potvrďte, že tahle adresa opravdu patří vám — " +
          "je to poslední krok.",
        "Potvrzení potřebujeme proto, že jako zákonný zástupce spravujete profil dítěte. " +
          "Bez ověřené adresy bychom vám nemohli poslat ani obnovu hesla.",
      ],
      button: { label: "Potvrdit adresu", url },
      footnote:
        "Odkaz platí 24 hodin. Pokud jste si účet nezakládali, tenhle e-mail ignorujte — " +
        "bez potvrzení účet do sedmi dnů sami smažeme.",
    },
  };
}

export function magicLinkEmail(url: string): EmailTemplate {
  return {
    subject: "Přihlášení do učebny",
    content: {
      preheader: "Odkaz pro přihlášení bez hesla.",
      heading: "Přihlášení do učebny",
      paragraphs: [
        "Tímto odkazem se přihlásíte bez zadávání hesla.",
        "Otevřete ho na zařízení, na kterém chcete být přihlášení.",
      ],
      button: { label: "Přihlásit se", url },
      footnote:
        "Odkaz platí 60 minut a použít ho lze jednou. " +
        "Pokud jste o přihlášení nežádali, nic nedělejte — bez otevření odkazu se nic nestane.",
    },
  };
}

export function recoveryEmail(url: string): EmailTemplate {
  return {
    subject: "Obnova hesla do učebny",
    content: {
      preheader: "Nastavte si nové heslo.",
      heading: "Obnova hesla",
      paragraphs: [
        "Požádali jste o obnovu hesla k účtu v učebně Weeks.",
        "Po otevření odkazu si rovnou nastavíte nové heslo.",
      ],
      button: { label: "Nastavit nové heslo", url },
      footnote:
        "Odkaz platí 60 minut. Pokud jste o obnovu nežádali, tenhle e-mail ignorujte — " +
        "vaše dosavadní heslo zůstává v platnosti a nikdo se k účtu nedostal.",
    },
  };
}

export function emailChangeEmail(url: string): EmailTemplate {
  return {
    subject: "Potvrzení změny e-mailové adresy",
    content: {
      preheader: "Potvrďte novou adresu u svého účtu.",
      heading: "Potvrzení změny e-mailové adresy",
      paragraphs: [
        "U účtu v učebně Weeks se mění e-mailová adresa. Potvrďte prosím, že nová adresa patří vám.",
        "Dokud změnu nepotvrdíte, zůstává v platnosti původní adresa.",
      ],
      button: { label: "Potvrdit novou adresu", url },
      footnote:
        "Pokud jste o změnu nežádali, okamžitě nám napište na info@weeks.cz. " +
        "Někdo se mohl pokusit dostat k vašemu účtu.",
    },
  };
}

export function inviteEmail(url: string): EmailTemplate {
  return {
    subject: "Pozvánka do učebny Weeks",
    content: {
      preheader: "Byl pro vás vytvořen účet v učebně.",
      heading: "Pozvánka do učebny",
      paragraphs: [
        "Byl pro vás vytvořen účet v učebně Weeks.",
        "Po otevření odkazu si nastavíte heslo a dokončíte založení profilu dítěte.",
      ],
      button: { label: "Dokončit registraci", url },
      footnote: "Odkaz platí 24 hodin.",
    },
  };
}

export function reauthenticationEmail(code: string): EmailTemplate {
  return {
    subject: "Ověřovací kód",
    content: {
      preheader: `Kód: ${code}`,
      heading: "Ověřovací kód",
      paragraphs: [
        `Pro dokončení akce zadejte tento kód: ${code}`,
        "Kód nikomu nepředávejte. Nikdy si o něj nepíšeme e-mailem ani telefonicky.",
      ],
      footnote: "Kód platí 60 minut.",
    },
  };
}
