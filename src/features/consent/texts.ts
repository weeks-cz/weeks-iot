import { CONTROLLER, SITE } from "@/lib/site";
import type { ConsentKind } from "@/lib/supabase/types";

/**
 * Znění souhlasů.
 *
 * ── Jak se to mění ─────────────────────────────────────────────────────────
 * Kdo upraví text, MUSÍ zvýšit `version`. Do ledgeru se ukládá snapshot
 * plného znění, takže staré souhlasy zůstanou navázané na text, který lidé
 * skutečně viděli. Bez bumpnutí verze by v databázi vznikly dva různé
 * souhlasy pod stejným označením a ledger by přestal být důkazem.
 *
 * ── Právní rámec ───────────────────────────────────────────────────────────
 * Česká republika snížila věk digitálního souhlasu na 15 let
 * (§ 7 zák. č. 110/2019 Sb., k čl. 8 GDPR). Z toho plyne rozdvojení:
 *
 *   • dítě mladší 15 let  → účet zakládá rodič, souhlas dává zákonný zástupce
 *   • od 15 let výš       → účet i souhlas patří samotnému uživateli
 *
 * Nikdy obojí. Dva souhlasy k témuž zpracování by si odporovaly, a nutit
 * patnáctiletého zaškrtnout „jsem zákonný zástupce" by vyrobilo nepravdivý
 * záznam — ledger, který obsahuje nepravdu, přestává být dokladem.
 *
 * Prvky jsou schválně oddělené. Sdružený box „souhlasím se vším" by byl
 * neplatný — souhlas musí být konkrétní, informovaný a oddělitelný
 * (čl. 7 odst. 2 GDPR). Ani jeden není předvyplněný.
 */

export interface ConsentText {
  kind: ConsentKind;
  version: string;
  /** Text u zaškrtávacího políčka. Krátký, srozumitelný, bez právničiny. */
  label: string;
  /** Rozbalitelné plné znění. Tohle se ukládá do ledgeru. */
  full: string;
  required: boolean;
}

const CONTROLLER_LINE = `${CONTROLLER.name}, IČO ${CONTROLLER.ico}, ${CONTROLLER.email}`;

export const TERMS_TEXT: ConsentText = {
  kind: "terms",
  version: "terms-v1",
  required: true,
  label: "Přečetl/a jsem si podmínky užití a zásady ochrany osobních údajů.",
  full: `PODMÍNKY UŽITÍ A ZÁSADY OCHRANY OSOBNÍCH ÚDAJŮ

Správce osobních údajů: ${CONTROLLER_LINE}
Služba: ${SITE.name} (${SITE.url})

Vytvořením účtu potvrzujete, že jste se seznámil/a s podmínkami užití služby
a se zásadami ochrany osobních údajů dostupnými na ${CONTROLLER.termsUrl}
a ${CONTROLLER.privacyUrl}.

Vaše údaje jako uživatele účtu (e-mailová adresa, kraj) zpracováváme na
právním základě plnění smlouvy podle čl. 6 odst. 1 písm. b) GDPR — bez nich
nelze účet provozovat.

Účet můžete kdykoli zrušit v sekci Účet. Zrušením se smažou profily dětí,
jejich postup i uložené projekty.`,
};

export const PARENTAL_TEXT: ConsentText = {
  kind: "parental",
  version: "parental-v1",
  required: true,
  label:
    "Jsem zákonný zástupce dítěte a souhlasím se zpracováním jeho údajů " +
    "pro provoz učebny.",
  full: `SOUHLAS ZÁKONNÉHO ZÁSTUPCE SE ZPRACOVÁNÍM OSOBNÍCH ÚDAJŮ DÍTĚTE

Správce osobních údajů: ${CONTROLLER_LINE}

1. PROHLÁŠENÍ
Prohlašuji, že jsem zákonným zástupcem dítěte, jehož profil v učebně
zakládám, nebo že jsem osobou vykonávající rodičovskou odpovědnost, a že
jsem oprávněn/a udělit tento souhlas.

2. JAKÉ ÚDAJE DÍTĚTE ZPRACOVÁVÁME
  • přezdívku, kterou dítěti zvolíte (nemusí to být skutečné jméno),
  • rok narození dítěte (nikoli přesné datum),
  • zvolený avatar,
  • postup v lekcích: kdy dítě lekci začalo, kdy ji dokončilo a jak dlouho mu to trvalo,
  • projekty, které dítě v učebně vytvoří (zapojení obvodů, 3D modely, kód).

Záměrně nesbíráme jméno a příjmení dítěte, jeho adresu, fotografii ani
zdravotní údaje. Rok narození místo data narození je zvolený proto, že
na věkové pásmo stačí a je to méně údajů.

3. K ČEMU ÚDAJE POUŽÍVÁME
  • abychom dítěti mohli zobrazit jeho vlastní postup a uložit jeho projekty,
  • abychom vám jako rodiči mohli ukázat, co dítě dokázalo,
  • abychom obsah lekcí přizpůsobili věkové skupině,
  • abychom v souhrnné a anonymizované podobě vyhodnocovali, které lekce
    děti dokončují a které je ztrácejí.

Údaje dítěte NEPOUŽÍVÁME k reklamnímu cílení a nepředáváme je třetím
stranám k marketingovým účelům. Neprovádíme automatizované rozhodování
ani profilování s právními účinky pro dítě.

4. PRÁVNÍ ZÁKLAD
Souhlas zákonného zástupce podle čl. 6 odst. 1 písm. a) ve spojení s čl. 8
GDPR a § 7 zákona č. 110/2019 Sb. Pro děti mladší 15 let je souhlas
zákonného zástupce nezbytný.

5. KDO SE K ÚDAJŮM DOSTANE
Zpracovatelé, kteří pro nás zajišťují technický provoz:
  • Supabase — databáze a přihlašování (servery v Evropské unii),
  • Vercel — provoz aplikace,
  • Resend — odesílání e-mailů.
S každým z nich máme uzavřenou smlouvu o zpracování osobních údajů.
Údaje nepředáváme mimo Evropský hospodářský prostor bez odpovídajících záruk.

6. JAK DLOUHO ÚDAJE UCHOVÁVÁME
Po dobu trvání účtu. Po jeho zrušení nebo po odvolání tohoto souhlasu
údaje dítěte smažeme nejpozději do 30 dnů. Záznam o udělení a odvolání
souhlasu si ponecháváme i poté — je to doklad o tom, že jsme souhlas
měli a že jsme jej respektovali.

7. ODVOLÁNÍ SOUHLASU
Souhlas můžete kdykoli odvolat jediným tlačítkem v sekci Účet → Souhlasy,
tedy stejně snadno, jako jste jej udělil/a. Odvolání nemá vliv na
zákonnost zpracování před jeho odvoláním.

Upozornění: bez tohoto souhlasu nemá zpracování údajů dítěte právní základ.
Jeho odvolání proto znamená smazání profilů dětí včetně jejich postupu
a projektů. Před smazáním si můžete projekty stáhnout.

8. VAŠE PRÁVA
Máte právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování,
přenositelnost a právo vznést námitku. Uplatníte je na ${CONTROLLER.email}.
Máte také právo podat stížnost u Úřadu pro ochranu osobních údajů,
Pplk. Sochora 27, 170 00 Praha 7, uoou.cz.

9. ZÁZNAM O SOUHLASU
K tomuto souhlasu ukládáme datum a čas udělení, verzi znění, jeho plné
znění a vaši IP adresu s údajem o prohlížeči. IP adresu zpracováváme na
základě oprávněného zájmu podle čl. 6 odst. 1 písm. f) GDPR, a to výhradně
jako doklad o tom, že souhlas byl udělen.`,
};

export const SELF_TEXT: ConsentText = {
  kind: "self",
  version: "self-v1",
  required: true,
  label: "Souhlasím se zpracováním svých údajů pro provoz učebny.",
  full: `SOUHLAS SE ZPRACOVÁNÍM OSOBNÍCH ÚDAJŮ

Správce osobních údajů: ${CONTROLLER_LINE}

1. KDO TENHLE SOUHLAS DÁVÁ
Tento souhlas uděluješ sám nebo sama za sebe. Podle § 7 zákona
č. 110/2019 Sb. může se zpracováním svých údajů v online službě souhlasit
každý od 15 let věku; do té doby musí souhlas dát zákonný zástupce.

2. JAKÉ ÚDAJE ZPRACOVÁVÁME
  • e-mailovou adresu, kterou sis zaregistroval/a,
  • přezdívku (nemusí to být tvé skutečné jméno),
  • rok narození (nikoli přesné datum),
  • kraj, ve kterém bydlíš,
  • zvolený avatar,
  • postup v lekcích: kdy jsi lekci začal/a, kdy dokončil/a a jak dlouho ti trvala,
  • projekty, které v učebně vytvoříš (zapojení obvodů, 3D modely, kód).

Záměrně nesbíráme jméno a příjmení, adresu, fotografii ani zdravotní údaje.

3. K ČEMU ÚDAJE POUŽÍVÁME
  • abychom ti mohli ukázat tvůj postup a uložit tvé projekty,
  • abychom obsah přizpůsobili věkové skupině,
  • abychom v souhrnné a anonymizované podobě vyhodnocovali, které lekce
    lidé dokončují a které je ztrácejí.

Údaje NEPOUŽÍVÁME k reklamnímu cílení a nepředáváme je třetím stranám
k marketingovým účelům. Neprovádíme automatizované rozhodování ani
profilování s právními účinky.

4. PRÁVNÍ ZÁKLAD
Tvůj souhlas podle čl. 6 odst. 1 písm. a) GDPR.

5. KDO SE K ÚDAJŮM DOSTANE
Zpracovatelé, kteří pro nás zajišťují technický provoz:
  • Supabase — databáze a přihlašování (servery v Evropské unii),
  • Vercel — provoz aplikace,
  • Resend — odesílání e-mailů.
S každým z nich máme uzavřenou smlouvu o zpracování osobních údajů.
Údaje nepředáváme mimo Evropský hospodářský prostor bez odpovídajících záruk.

6. JAK DLOUHO ÚDAJE UCHOVÁVÁME
Po dobu trvání účtu. Po jeho zrušení nebo po odvolání tohoto souhlasu je
smažeme nejpozději do 30 dnů.

7. ODVOLÁNÍ SOUHLASU
Souhlas můžeš kdykoli odvolat jediným tlačítkem v sekci Účet → Souhlasy,
tedy stejně snadno, jako jsi jej udělil/a. Odvolání nemá vliv na zákonnost
zpracování před jeho odvoláním.

Upozornění: bez tohoto souhlasu nemá zpracování tvých údajů právní základ.
Jeho odvolání proto znamená zrušení účtu včetně postupu a projektů.
Před zrušením si projekty můžeš stáhnout.

8. NĚKTERÉ VĚCI POTŘEBUJÍ RODIČE I TAK
Pokud ti ještě nebylo 18, k zaplacení předplatného a k přihlášení na letní
tábor je stále potřeba tvůj zákonný zástupce. Obsah učebny zdarma
používáš bez něj.

9. TVÁ PRÁVA
Máš právo na přístup k údajům, jejich opravu, výmaz, omezení zpracování,
přenositelnost a právo vznést námitku. Uplatníš je na ${CONTROLLER.email}.
Máš také právo podat stížnost u Úřadu pro ochranu osobních údajů,
Pplk. Sochora 27, 170 00 Praha 7, uoou.cz.

10. ZÁZNAM O SOUHLASU
K tomuto souhlasu ukládáme datum a čas udělení, verzi znění, jeho plné
znění a tvou IP adresu s údajem o prohlížeči. IP adresu zpracováváme na
základě oprávněného zájmu podle čl. 6 odst. 1 písm. f) GDPR, a to výhradně
jako doklad o tom, že souhlas byl udělen.`,
};

export const MARKETING_TEXT: ConsentText = {
  kind: "marketing",
  version: "marketing-v1",
  required: false,
  label: "Chci e-mailem novinky o učebně, nových kurzech a letních táborech.",
  full: `SOUHLAS SE ZASÍLÁNÍM OBCHODNÍCH SDĚLENÍ

Správce osobních údajů: ${CONTROLLER_LINE}

Souhlasím, aby správce zpracovával mou e-mailovou adresu za účelem zasílání
informací o nových kurzech a lekcích v učebně, o termínech letních táborů
Weeks a o souvisejících nabídkách.

Právní základ: souhlas podle čl. 6 odst. 1 písm. a) GDPR a § 7 zákona
č. 480/2004 Sb., o některých službách informační společnosti.

Tento souhlas je zcela dobrovolný. Bez něj učebna funguje úplně stejně
a nepřijdete o žádnou její část. Odmítnutí nemá na účet ani na dítě
žádný vliv.

Souhlas platí do odvolání, nejdéle však 3 roky od poslední interakce.
Odvolat jej můžete kdykoli jedním tlačítkem v sekci Účet → Souhlasy nebo
odkazem v patičce každého e-mailu. Provozní e-maily týkající se účtu
(potvrzení adresy, obnova hesla, upozornění na zrušení účtu) chodí
nezávisle na tomto souhlasu, protože bez nich nelze účet provozovat.`,
};

export const CONSENT_TEXTS: readonly ConsentText[] = [
  TERMS_TEXT,
  PARENTAL_TEXT,
  SELF_TEXT,
  MARKETING_TEXT,
] as const;

/**
 * Které souhlasy se ptají podle věku učícího se.
 *
 * Pod 15 let souhlasí zákonný zástupce, od 15 člověk sám za sebe. Nikdy
 * obojí — dva souhlasy k témuž zpracování by si navzájem odporovaly.
 */
export function consentTextsForAge(isMinor: boolean): readonly ConsentText[] {
  return CONSENT_TEXTS.filter((t) =>
    t.kind === "parental" ? isMinor : t.kind === "self" ? !isMinor : true,
  );
}

export function consentTextFor(kind: ConsentKind): ConsentText {
  const found = CONSENT_TEXTS.find((t) => t.kind === kind);
  if (!found) throw new Error(`Chybí znění souhlasu pro druh "${kind}"`);
  return found;
}
