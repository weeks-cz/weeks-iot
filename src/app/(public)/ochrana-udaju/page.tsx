import type { Metadata } from "next";
import { LegalDoc } from "@/components/ui/LegalDoc";
import { CONTROLLER } from "@/lib/site";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů",
  description: "Jaké údaje učebna Weeks zpracovává, proč a jak dlouho.",
};

/*
 * NÁVRH K PRÁVNÍ KONTROLE (28. 9. 2026).
 *
 * Text popisuje, co aplikace v tuhle chvíli opravdu dělá — ne co by
 * dělat mohla. Kdo mění sběr dat (nová událost v analytics, nový
 * zpracovatel, nové pole v onboardingu), mění i tuhle stránku a texty
 * souhlasů (features/consent/texts.ts, s bumpem verze).
 *
 * Otevřené otázky pro právníka:
 *  - Náhodný identifikátor v localStorage u anonymní návštěvy (anon_id)
 *    se ukládá bez souhlasu, na oprávněný zájem. Podle § 89 odst. 3
 *    zák. 127/2005 Sb. může uložení do zařízení vyžadovat souhlas,
 *    pokud není nezbytné pro službu.
 *  - Doba uchování anonymních událostí (dnes neomezená).
 */
export default function PrivacyPage() {
  return (
    <LegalDoc title="Ochrana osobních údajů" updated="19. 11. 2026">
      <section>
        <h2>Kdo údaje zpracovává</h2>
        <p>
          Učebnu provozuje {CONTROLLER.name}, která je správcem osobních údajů (údaje
          výše). Se vším, co se týká vašich údajů nebo údajů vašeho dítěte, nám pište na{" "}
          {CONTROLLER.email}.
        </p>
      </section>

      <section>
        <h2>Když si lekci jen zkoušíte, bez účtu</h2>
        <p>
          Rozdělaný obvod a program se ukládají jen ve vašem prohlížeči (localStorage).
          K nám se nedostanou.
        </p>
        <p>
          Prohlížeč si zároveň pamatuje náhodný identifikátor, který nikoho nepojmenovává.
          S ním nám posílá, že se návštěva uskutečnila, kterou lekci dítě začalo a dokončilo
          a odkud návštěva přišla: odkazující stránku, označení kampaně v odkazu a to, jestli
          jde o prohlížeč uvnitř aplikace Facebook nebo Instagram. Nic dalšího o vašem
          prohlížeči ani zařízení si neukládáme.
        </p>
        <p>
          Stejně zaznamenáváme, jak daleko jste se dostali v registraci: že jste ji otevřeli,
          odeslali formulář nebo zvolili přihlášení přes Google a jestli se to povedlo. Obsah
          formuláře, tedy e-mail ani heslo, k těmto záznamům nepatří.
        </p>
        <p>
          Díky tomu víme, které lekce děti dokončují, kde je ztrácíme a kde se zasekává
          registrace. Jméno, e-mail ani IP adresu k těmto záznamům neukládáme. Právním
          základem je náš oprávněný zájem na zlepšování učebny (čl. 6 odst. 1 písm. f) GDPR).
        </p>
      </section>

      {/* Návrh k právníkovi (19. 11. 2026) */}
      <section>
        <h2>Odkaz na počítač</h2>
        <p>
          Na stránce pro rodiče si můžete nechat poslat e-mailem odkaz na první lekci,
          abyste ji dítěti otevřeli na počítači. K tomu ukládáme:
        </p>
        <ul>
          <li>vaši e-mailovou adresu,</li>
          <li>
            zdroj návštěvy, ze které jste formulář odeslali: označení kampaně v odkazu,
            odkazující stránku a to, jestli šlo o prohlížeč uvnitř aplikace Facebook nebo
            Instagram, nebo o běžný prohlížeč,
          </li>
          <li>jestli jste dali souhlas s dalšími e-maily,</li>
          <li>
            kdy jste odkaz poprvé otevřeli, zvlášť na počítači a zvlášť na libovolném
            zařízení.
          </li>
        </ul>
        <p>
          K těmto záznamům neukládáme žádný identifikátor prohlížeče ani postup dítěte
          v lekcích.
        </p>
        <p>
          Odeslání odkazu, o který jste požádali, je plnění vaší žádosti (čl.&nbsp;6
          odst.&nbsp;1 písm.&nbsp;b) GDPR) a chodí bez souhlasu. Jedna připomínka, kdyby se
          dítě k učebně nedostalo, a občasné tipy z učebny a nabídky táborů Weeks chodí
          jen na základě vašeho samostatného, předem nezaškrtnutého souhlasu (čl.&nbsp;6
          odst.&nbsp;1 písm.&nbsp;a) GDPR). Pokud ho dáte, předáme Meta Platforms Ireland
          Limited otisk (hash) e-mailu, IP adresu a údaje o prohlížeči, jak je popsáno
          v&nbsp;textu souhlasu. Meta v tom případě jedná jako samostatný správce.
        </p>
        <p>
          Adresa, jejíž majitel odkaz neotevřel, dostane nejvýš jednu připomínku. Tipy
          a nabídky posíláme jen těm, kdo odkaz aspoň jednou otevřeli, protože tím
          prokázali, že schránka je jejich.
        </p>
        <p>
          Souhlas odvoláte odkazem &bdquo;Nechci další e-maily&ldquo; v každém takovém
          e-mailu, nebo zprávou na {CONTROLLER.email}. Zpracovatelem pro odesílání e-mailů
          je Resend.
        </p>
      </section>

      <section>
        <h2>Cookies a měření návštěvnosti</h2>
        <p>
          Nezbytné věci (přihlášení, zapamatování vašeho výběru) potřebujeme vždy a
          nevyžadují souhlas. Dvě měřicí služby se načtou až po vašem souhlasu, který
          můžete kdykoli změnit odkazem &bdquo;Nastavení cookies&ldquo; v patičce:
        </p>
        <ul>
          <li>
            <strong>Google Analytics 4</strong> (Google Ireland Limited) — anonymní statistiky,
            které lekce děti dokončují a kde se ztrácí. Běží na všech stránkách, i v lekcích.
          </li>
          <li>
            <strong>Meta Pixel</strong> (Meta Platforms Ireland Limited) — měření reklam.
            Běží jen na veřejné části a v rodičovské zóně (registrace, účet), nikdy na
            dětských obrazovkách a v lekcích.
          </li>
        </ul>
        <p>
          Pokud dáte souhlas s marketingem při registraci, odesíláme Meta serverem také
          informaci, že se rodič zaregistroval. Předáme jí e-mail v podobě otisku (hash),
          IP adresu a údaje o prohlížeči. Bez tohoto souhlasu se nic z toho neposílá.
          Meta v tomto případě jedná jako samostatný správce údajů, které získá.
        </p>
        <p>
          Právním základem je váš souhlas (čl. 6 odst. 1 písm. a) GDPR). Odmítnutí nemá
          žádný vliv na používání učebny.
        </p>
      </section>

      <section>
        <h2>Účet rodiče</h2>
        <ul>
          <li>e-mailová adresa (nebo přihlášení přes Google),</li>
          <li>kraj, ve kterém bydlíte,</li>
          <li>heslo — ukládá se jen jako nevratný otisk, takže ho nikdo nepřečte, ani my.</li>
        </ul>
        <p>
          Bez těchto údajů nelze účet provozovat, zpracováváme je proto na základě plnění
          smlouvy (čl. 6 odst. 1 písm. b) GDPR).
        </p>
        <p>
          K účtu si dále zaznamenáváme, jak registrace proběhla: jestli jste ji dokončili
          e-mailem, nebo přes Google, kdy jste potvrdili adresu (a jestli odkaz z e-mailu
          otevřel běžný prohlížeč, nebo prohlížeč aplikace Facebook či Instagram) a kterými
          kroky dokončení registrace jste prošli. Záznamy z doby před registrací, popsané
          výše, se tím s účtem propojí. Slouží jen k tomu, abychom věděli, kde registrace
          drhne. Právním základem je náš oprávněný zájem (čl. 6 odst. 1 písm. f) GDPR).
        </p>
      </section>

      <section>
        <h2>Údaje dítěte</h2>
        <ul>
          <li>přezdívka, kterou dítěti zvolíte (nemusí to být skutečné jméno),</li>
          <li>datum narození — podle něj poznáme, kdy dítěti bude 15 let,</li>
          <li>zvolený avatar,</li>
          <li>postup v lekcích — kdy lekci začalo, dokončilo a jak dlouho mu trvala,</li>
          <li>projekty, které v učebně vytvoří (zapojení obvodu, program).</li>
        </ul>
        <p>
          Záměrně nesbíráme jméno a příjmení dítěte, adresu, fotografii ani zdravotní údaje.
          Za dítě mladší 15 let dává souhlas zákonný zástupce (čl. 8 GDPR, § 7 zák.
          č. 110/2019 Sb.); od 15 let souhlasí uživatel sám za sebe. Údaje dítěte nepoužíváme
          k reklamnímu cílení, nepředáváme je k marketingu a neprovádíme automatizované
          rozhodování ani profilování.
        </p>
      </section>

      <section>
        <h2>Záznam o souhlasu</h2>
        <p>
          Ke každému udělenému i odvolanému souhlasu ukládáme datum a čas, verzi a plné znění
          textu, IP adresu a údaj o prohlížeči. Je to doklad, že jsme souhlas měli a že jsme
          ho respektovali (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR). Záznam
          uchováváme i po zrušení účtu, ale už odpojený od vaší osoby: nejdéle 3 roky od
          smazání účtu, poté ho smažeme.
        </p>
      </section>

      <section>
        <h2>Novinky e-mailem</h2>
        <p>
          Jen pokud jste o ně výslovně požádali. Souhlas je dobrovolný, učebna bez něj
          funguje stejně a odvolat ho můžete jedním tlačítkem v sekci Účet → Souhlasy nebo
          odkazem v každém e-mailu. Provozní e-maily (potvrzení adresy, obnova hesla)
          chodí bez ohledu na něj.
        </p>
      </section>

      <section>
        <h2>Kdo se k údajům dostane</h2>
        <p>Technický provoz pro nás zajišťují zpracovatelé, se kterými máme smlouvu:</p>
        <ul>
          <li>Supabase — databáze a přihlašování (servery v Evropské unii),</li>
          <li>Vercel — provoz aplikace,</li>
          <li>Resend — odesílání e-mailů,</li>
          <li>Google — jen pokud se přihlašujete účtem Google,</li>
          <li>Google Analytics 4 a Meta Platforms Ireland Limited (Meta Pixel a serverová
            konverze) — jen po vašem souhlasu s cookies a marketingem, viz výše.</li>
        </ul>
        <p>
          Údaje nepředáváme mimo Evropský hospodářský prostor bez odpovídajících záruk.
        </p>
      </section>

      <section>
        <h2>Jak dlouho údaje máme</h2>
        <p>
          Po dobu trvání účtu. Po jeho zrušení nebo po odvolání souhlasu údaje dítěte
          smažeme nejpozději do 30 dnů. Výjimkou je záznam o souhlasu popsaný výše — ten
          uchováváme nejdéle 3 roky od smazání účtu.
        </p>
        <p>
          Žádost o odkaz na počítač bez souhlasu s dalšími e-maily, nebo po jeho odvolání,
          uchováváme 90&nbsp;dnů od vaší žádosti. Pak e-mailovou adresu smažeme
          a zbytek (zdroj návštěvy, časy otevření) ponecháme jako anonymní statistiku.
          Pokud souhlas dáte, držíme adresu do jeho odvolání. Záznam o souhlasu zůstává
          jako doklad, jak je popsáno výše.
        </p>
      </section>

      <section>
        <h2>Vaše práva</h2>
        <p>
          Máte právo na přístup ke svým údajům, jejich opravu, výmaz, omezení zpracování,
          přenositelnost a právo vznést námitku. Souhlas můžete kdykoli odvolat v sekci
          Účet → Souhlasy — stejně snadno, jako jste ho dali. Ozvěte se na{" "}
          {CONTROLLER.email}. Máte také právo podat stížnost u Úřadu pro ochranu osobních
          údajů, Pplk. Sochora 27, 170 00 Praha 7, uoou.gov.cz.
        </p>
      </section>
    </LegalDoc>
  );
}
