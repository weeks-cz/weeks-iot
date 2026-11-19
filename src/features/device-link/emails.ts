import type { EmailTemplate } from "@/lib/email/templates";

/**
 * E-maily k odkazu na počítač. Tón stejný jako u transakčních e-mailů:
 * vykání, krátce, bez vykřičníků a bez slibů nad rámec toho, co stránka tvrdí.
 */

const BUTTON_LABEL = "Otevřít učebnu";
const UNSUBSCRIBE_LABEL = "Nechci další e-maily";

export function deviceLinkEmail(p: {
  lessonUrl: string;
  unsubscribeUrl: string | null;
}): EmailTemplate {
  return {
    subject: "Odkaz na Učebnu Weeks pro vaše dítě",
    content: {
      preheader: "První lekce se otevře v prohlížeči, bez instalace.",
      heading: "Odkaz na učebnu pro vaše dítě",
      paragraphs: [
        "Dítě bude potřebovat počítač nebo notebook, ideálně s myší, a asi 20 minut času. " +
          "Nic se neinstaluje, učebna běží v prohlížeči.",
        "První lekce jde otevřít bez účtu. Pokud chcete, aby se dítěti ukládal postup " +
          "a získalo certifikát, bude k tomu potřeba účet rodiče.",
      ],
      button: { label: BUTTON_LABEL, url: p.lessonUrl },
      footnote:
        "Požádali jste o odkaz na ucebna.weeks.cz. Pokud jste to nebyli vy, " +
        "tenhle e-mail ignorujte, nic se nestane.",
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
      heading: "Dítě se k učebně ještě nedostalo?",
      paragraphs: [
        "Před pár dny jsme vám poslali odkaz na učebnu Weeks. Zatím se přes něj nikdo neotevřel na počítači.",
        "První lekce zabere asi 20 minut a jde otevřít bez účtu. Stačí počítač nebo notebook a prohlížeč.",
      ],
      button: { label: BUTTON_LABEL, url: p.lessonUrl },
      footnote:
        "Tohle je jediná připomínka, kterou pošleme. Posíláme ji, protože jste s ní při žádosti o odkaz souhlasili.",
      secondaryLink: { label: UNSUBSCRIBE_LABEL, url: p.unsubscribeUrl },
    },
  };
}
