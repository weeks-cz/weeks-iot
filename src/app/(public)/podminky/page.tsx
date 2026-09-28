import type { Metadata } from "next";
import { LegalDoc } from "@/components/ui/LegalDoc";
import { CONTROLLER, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Podmínky užití",
  description: "Pravidla používání učebny Weeks.",
};

/*
 * NÁVRH K PRÁVNÍ KONTROLE (28. 9. 2026).
 *
 * Dřív se odkazovalo na weeks.cz/podminky, jenže to jsou obchodní
 * podmínky táborů — o účtu v učebně neříkají nic. Placené části tu zatím
 * nejsou; až přibudou, dostanou vlastní obchodní podmínky a prodávajícím
 * musí být ten, kdo platby opravdu přijímá.
 */
export default function TermsPage() {
  return (
    <LegalDoc title="Podmínky užití" updated="28. 9. 2026">
      <section>
        <h2>O co jde</h2>
        <p>
          {SITE.name} ({SITE.url}) je online učebna, ve které si děti skládají obvody
          a programují je přímo v prohlížeči. Provozuje ji {CONTROLLER.name}. Vytvořením
          účtu s těmito podmínkami souhlasíte.
        </p>
      </section>

      <section>
        <h2>Kdo může mít účet</h2>
        <p>
          Za dítě mladší 15 let zakládá účet a dává souhlasy jeho zákonný zástupce. Od 15 let
          si účet může založit uživatel sám. První lekci si může vyzkoušet kdokoli, bez účtu.
        </p>
      </section>

      <section>
        <h2>Jak učebnu používat</h2>
        <ul>
          <li>Přihlašovací údaje si chraňte a nesdílejte je s cizími lidmi.</li>
          <li>Nezkoušejte obcházet zabezpečení ani zatěžovat službu automatizovaně.</li>
          <li>Do přezdívky a projektů nepište nic urážlivého ani cizí osobní údaje.</li>
        </ul>
      </section>

      <section>
        <h2>Obsah a projekty</h2>
        <p>
          Lekce, texty, obrázky a kód učebny patří {CONTROLLER.name} a slouží k osobnímu
          učení. Obvody a programy, které si dítě v učebně vytvoří, patří jemu.
        </p>
      </section>

      <section>
        <h2>Dostupnost</h2>
        <p>
          Učebnu průběžně vylepšujeme, takže se lekce i ovládání můžou měnit. Snažíme se, aby
          běžela bez výpadků, ale nepřetržitý provoz zaručit nemůžeme. Simulátor ukazuje, jak
          se obvod zachová, a nenahrazuje bezpečnostní pravidla při práci se skutečnou
          elektronikou.
        </p>
      </section>

      <section>
        <h2>Zrušení účtu</h2>
        <p>
          Účet můžete kdykoli zrušit v sekci Účet. Zrušením se smažou profily dětí, jejich
          postup i uložené projekty. Účet, který tyto podmínky hrubě porušuje, můžeme po
          upozornění zrušit i my.
        </p>
      </section>

      <section>
        <h2>Změny podmínek</h2>
        <p>
          O podstatné změně vás předem informujeme e-mailem. Pokud s ní nesouhlasíte, můžete
          účet zrušit. Tyto podmínky se řídí právem České republiky.
        </p>
      </section>

      <section>
        <h2>Osobní údaje</h2>
        <p>
          Jak s údaji zacházíme, popisují{" "}
          <a href="/ochrana-udaju" className="font-semibold text-primary-700 underline underline-offset-4">
            zásady ochrany osobních údajů
          </a>
          .
        </p>
      </section>
    </LegalDoc>
  );
}
