import type { EmailTemplate } from "./templates";
import { SITE } from "@/lib/site";

/**
 * Sekvence po registraci.
 *
 * „Registrace bez follow-upu se do měsíce vypaří." Tři e-maily, každý má
 * jeden úkol a jeden odkaz.
 *
 * ── Co se sem záměrně nedostalo ────────────────────────────────────────────
 * Žádné „ještě jste nezačali!" s vykřičníkem a žádná umělá naléhavost.
 * Píše se rodiči, který svěřil údaje dítěte — vteřina, kdy to začne znít
 * jako výprodej, je vteřina, kdy se odhlásí.
 *
 * ── Souhlas ────────────────────────────────────────────────────────────────
 * Uvítací e-mail je provozní: potvrzuje založený účet a chodí i bez souhlasu
 * s obchodními sděleními. Připomenutí a pozvánka na tábor jsou obchodní
 * sdělení a posílají se VÝHRADNĚ tomu, kdo souhlas dal. Rozhoduje o tom
 * `requiresMarketingConsent` a kontroluje to cron před odesláním.
 */

export interface SequenceStep {
  id: "welcome" | "nudge" | "camp";
  /** Kolik dní po dokončení onboardingu se odesílá. */
  afterDays: number;
  /** Obchodní sdělení? Pak jen se souhlasem. */
  requiresMarketingConsent: boolean;
}

export const SEQUENCE: SequenceStep[] = [
  { id: "welcome", afterDays: 0, requiresMarketingConsent: false },
  { id: "nudge", afterDays: 3, requiresMarketingConsent: true },
  { id: "camp", afterDays: 7, requiresMarketingConsent: true },
];

export interface SequenceContext {
  /** Přezdívka učícího se profilu. */
  nick: string;
  /** Tyká se samostatnému účtu, vyká rodiči. */
  formal: boolean;
  /** Ve spádu se zve na tábor, jinak na čekačku měst. */
  inCatchment: boolean;
  /** Dokončil aspoň jednu lekci? Mění text připomenutí. */
  startedLearning: boolean;
}

const utm = (content: string) =>
  `utm_source=ucebna&utm_medium=email&utm_campaign=onboarding&utm_content=${content}`;

export function welcomeEmail(ctx: SequenceContext): EmailTemplate {
  const you = ctx.formal ? "Váš účet je hotový" : "Tvůj účet je hotový";

  return {
    subject: "Účet v učebně je hotový",
    content: {
      preheader: `Profil ${ctx.nick} je připravený. První lekce čeká.`,
      heading: you,
      paragraphs: ctx.formal
        ? [
            `Profil ${ctx.nick} je připravený a první lekce čeká.`,
            "V lekci se skládá obvod přímo v prohlížeči — žádné součástky ani instalace nejsou potřeba. Zabere to asi dvacet minut.",
            "V sekci Účet uvidíte, co dítě dokázalo, a kdykoli tam můžete upravit souhlasy nebo účet zrušit.",
          ]
        : [
            `Profil ${ctx.nick} je připravený a první lekce čeká.`,
            "Obvod poskládáš přímo v prohlížeči — nepotřebuješ součástky ani nic instalovat. Zabere to asi dvacet minut.",
            "V sekci Účet máš přehled o svém postupu a můžeš tam kdykoli upravit souhlasy.",
          ],
      button: {
        label: "Otevřít první lekci",
        url: `${SITE.url}/kurz/iot/rozsvit-ledku/?${utm("welcome")}`,
      },
    },
  };
}

export function nudgeEmail(ctx: SequenceContext): EmailTemplate {
  const heading = ctx.startedLearning ? "Pokračování čeká" : "První lekce pořád čeká";

  return {
    subject: heading,
    content: {
      preheader: "Dvacet minut a rozsvícená LED.",
      heading,
      paragraphs: ctx.startedLearning
        ? [
            `${ctx.nick} má za sebou první krok. Další lekce navazuje tam, kde ta předchozí skončila.`,
            "Postup se ukládá sám, takže se dá kdykoli přestat a vrátit.",
          ]
        : [
            `Založili jste profil ${ctx.nick}, ale k první lekci se zatím nikdo nedostal.`,
            "Je to dvacet minut a na konci svítí LED, kterou dítě samo zapojilo. Nic se neinstaluje, všechno běží v prohlížeči.",
          ],
      button: {
        label: ctx.startedLearning ? "Pokračovat" : "Zkusit první lekci",
        url: `${SITE.url}/kurz/iot/rozsvit-ledku/?${utm("nudge")}`,
      },
      footnote:
        "Tohle je obchodní sdělení. Odhlásíte se jedním tlačítkem v sekci Účet → Souhlasy.",
    },
  };
}

export function campEmail(ctx: SequenceContext): EmailTemplate {
  /* Jediné místo, kde se z uživatele stává zákazník. Ve spádu karta
     termínu, mimo něj čekačka — ta je zároveň podkladem pro expanzi. */
  if (ctx.inCatchment) {
    return {
      subject: "To, co staví v učebně, si u nás postaví naživo",
      content: {
        preheader: "Příměstský tábor chytrých technologií. Předplatné se odečítá.",
        heading: "Za aplikací stojí lektor a léto",
        paragraphs: [
          "Weeks pořádá příměstské tábory chytrých technologií v Praze a Karlových Varech. Skutečné Arduino, skutečná 3D tiskárna a lektor u stolu.",
          "Roční předplatné učebny za 699 Kč se z ceny tábora odečítá.",
        ],
        button: {
          label: "Podívat se na termíny",
          url: `https://weeks.cz/karlovy-vary?${utm("email-camp")}`,
        },
        footnote:
          "Tohle je obchodní sdělení. Odhlásíte se jedním tlačítkem v sekci Účet → Souhlasy.",
      },
    };
  }

  return {
    subject: "Kam máme přijet příště?",
    content: {
      preheader: "Podle zájmu se rozhodujeme, kde otevřeme.",
      heading: "Zatím jezdíme jen v Praze a Karlových Varech",
      paragraphs: [
        "Do vašeho kraje se s letním táborem zatím nedostaneme.",
        "Napište nám ale své město. Podle toho, kde je zájem, se rozhodujeme, kam expandovat — a je to jediný podklad, který se nedá koupit ani odhadnout.",
      ],
      button: {
        label: "Přidat své město",
        url: `${SITE.url}/ucet/?${utm("email-waitlist")}`,
      },
      footnote:
        "Tohle je obchodní sdělení. Odhlásíte se jedním tlačítkem v sekci Účet → Souhlasy.",
    },
  };
}

export function buildStep(id: SequenceStep["id"], ctx: SequenceContext): EmailTemplate {
  switch (id) {
    case "welcome":
      return welcomeEmail(ctx);
    case "nudge":
      return nudgeEmail(ctx);
    case "camp":
      return campEmail(ctx);
  }
}
