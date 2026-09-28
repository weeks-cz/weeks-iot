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
    <LegalDoc title="Ochrana osobních údajů" updated="28. 9. 2026">
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
          a odkud návštěva přišla (odkazující stránka a označení kampaně v odkazu). Díky tomu
          víme, které lekce děti dokončují a kde je ztrácíme. Jméno, e-mail ani IP adresu
          k těmto záznamům neukládáme. Právním základem je náš oprávněný zájem na zlepšování
          učebny (čl. 6 odst. 1 písm. f) GDPR).
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
          ho respektovali (oprávněný zájem, čl. 6 odst. 1 písm. f) GDPR). Tento záznam
          uchováváme i po zrušení účtu.
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
          <li>Google — jen pokud se přihlašujete účtem Google.</li>
        </ul>
        <p>
          Údaje nepředáváme mimo Evropský hospodářský prostor bez odpovídajících záruk.
        </p>
      </section>

      <section>
        <h2>Jak dlouho údaje máme</h2>
        <p>
          Po dobu trvání účtu. Po jeho zrušení nebo po odvolání souhlasu údaje dítěte
          smažeme nejpozději do 30 dnů. Výjimkou je záznam o souhlasu popsaný výše.
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
