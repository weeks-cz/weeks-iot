import { SITE } from "@/lib/site";
import type { EmailTemplate } from "./templates";

/**
 * E-mail s certifikátem v příloze.
 *
 * Provozní zpráva — chodí každému, kdo kurz dokončí, bez ohledu na souhlas
 * s obchodními sděleními. Odstavec o táboře se proto přidává JEN se
 * souhlasem, a pak musí e-mail říct, že obsahuje obchodní sdělení. Bez
 * souhlasu by nabídka tábora z provozního e-mailu udělala reklamu.
 *
 * Pohlaví dítěte neznáme (profil má jen přezdívku), proto žádné
 * „prošel/prošla" — věty jsou postavené tak, aby rod nepotřebovaly.
 */

export interface CertificateEmailInput {
  nick: string;
  courseTitle: string;
  projectTitle: string;
  /** Vyká se rodiči, tyká tomu, kdo se učí sám (účet `self`). */
  formal: boolean;
  /** Má držitel účtu souhlas s obchodními sděleními? */
  camp: boolean;
}

const UTM = "utm_source=ucebna&utm_medium=email&utm_campaign=certifikat";

export function certificateEmail(input: CertificateEmailInput): EmailTemplate {
  const { nick, courseTitle, projectTitle, formal, camp } = input;

  const paragraphs = formal
    ? [
        `${nick} má za sebou celý kurz ${courseTitle}, včetně závěrečného projektu ${projectTitle}.`,
        "Certifikát najdete v příloze. Dá se vytisknout, a když na něm chcete celé jméno místo přezdívky, stáhnete si ho v účtu se jménem, které napíšete.",
      ]
    : [
        `Máš za sebou celý kurz ${courseTitle}, včetně závěrečného projektu ${projectTitle}.`,
        "Certifikát najdeš v příloze. Když na něm chceš celé jméno místo přezdívky, stáhneš si ho v účtu se jménem, které napíšeš.",
      ];

  if (camp) {
    paragraphs.push(
      formal
        ? "Kdo chce pokračovat se skutečným Arduinem, 3D tiskárnou a lektorem u stolu, může v létě na příměstský tábor Weeks v Praze nebo v Karlových Varech."
        : "Jestli chceš pokračovat se skutečným Arduinem, 3D tiskárnou a lektorem u stolu, v létě pořádáme příměstské tábory v Praze a v Karlových Varech.",
    );
  }

  return {
    subject: formal ? `${nick} má certifikát z kurzu ${courseTitle}` : `Tvůj certifikát z kurzu ${courseTitle}`,
    content: {
      preheader: formal ? "Certifikát je v příloze." : "Certifikát máš v příloze.",
      heading: formal ? `${nick} má hotový celý kurz` : "Kurz je hotový",
      paragraphs,
      button: camp
        ? { label: "Podívat se na tábory", url: `https://weeks.cz/tabory?${UTM}` }
        : { label: formal ? "Otevřít účet" : "Otevřít učebnu", url: `${SITE.url}/ucet/?${UTM}` },
      footnote: camp
        ? formal
          ? "Poslední odstavec je obchodní sdělení. Odhlásíte se jedním tlačítkem v sekci Účet → Souhlasy."
          : "Poslední odstavec je obchodní sdělení. Odhlásíš se jedním tlačítkem v sekci Účet → Souhlasy."
        : undefined,
    },
  };
}
