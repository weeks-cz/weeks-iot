import type { EmailTemplate } from "@/lib/email/templates";

/**
 * E-maily k odkazu na počítač. Tón stejný jako u transakčních e-mailů:
 * vykání, krátce, bez vykřičníků a bez slibů nad rámec toho, co stránka tvrdí.
 *
 * Nezlomitelná mezera (číslo s jednotkou, jednopísmenná slova) se píše jako
 * `${NBSP}`, nikdy jako neviditelný znak: ten se při úpravách ztrácí.
 */

const NBSP = "\u00a0";
const BUTTON_LABEL = "Otevřít učebnu";
const UNSUBSCRIBE_LABEL = "Nechci další e-maily";

export function deviceLinkEmail(p: {
  lessonUrl: string;
  unsubscribeUrl: string | null;
}): EmailTemplate {
  return {
    subject: "Odkaz na Učebnu Weeks pro vaše dítě",
    content: {
      preheader: `První lekce se otevře v${NBSP}prohlížeči, bez instalace.`,
      heading: "Odkaz na učebnu pro vaše dítě",
      paragraphs: [
        `Dítě bude potřebovat počítač nebo notebook, ideálně s${NBSP}myší, a${NBSP}asi 20${NBSP}minut času. ` +
          `Nic se neinstaluje, učebna běží v${NBSP}prohlížeči.`,
        `První lekce jde otevřít bez účtu. Pokud chcete, aby se dítěti ukládal postup ` +
          `a${NBSP}získalo certifikát, bude k${NBSP}tomu potřeba účet rodiče.`,
      ],
      button: { label: BUTTON_LABEL, url: p.lessonUrl },
      footnote:
        `Požádali jste o${NBSP}odkaz na ucebna.weeks.cz. Pokud jste to nebyli vy, ` +
        `tenhle e-mail ignorujte, nic se nestane.`,
      ...(p.unsubscribeUrl
        ? { secondaryLink: { label: UNSUBSCRIBE_LABEL, url: p.unsubscribeUrl } }
        : {}),
    },
  };
}

export function deviceLinkReminderEmail(p: {
  lessonUrl: string;
  unsubscribeUrl: string;
}): EmailTemplate {
  return {
    subject: "Dítě se k učebně ještě nedostalo?",
    content: {
      preheader: "Odkaz na první lekci platí dál.",
      heading: `Dítě se k${NBSP}učebně ještě nedostalo?`,
      paragraphs: [
        /* Netvrdíme, že odkaz nikdo neotevřel: otevření na telefonu
           připomínku neruší a otevření jiné žádosti nemusí být vidět. */
        `Před pár dny jsme vám poslali odkaz na učebnu Weeks. ` +
          `Pokud se k${NBSP}ní dítě ještě nedostalo, tady je odkaz znovu.`,
        `První lekce zabere asi 20${NBSP}minut a${NBSP}jde otevřít bez účtu. ` +
          `Stačí počítač nebo notebook a${NBSP}prohlížeč.`,
      ],
      button: { label: BUTTON_LABEL, url: p.lessonUrl },
      footnote:
        `Tohle je jediná připomínka, kterou pošleme. Posíláme ji, protože jste s${NBSP}ní ` +
        `při žádosti o${NBSP}odkaz souhlasili.`,
      secondaryLink: { label: UNSUBSCRIBE_LABEL, url: p.unsubscribeUrl },
    },
  };
}
