# Weeks IoT

Výuková IoT platforma pro děti z Weeks táborů. 21 úkolů s Arduinem ve třech obtížnostech (začátečník, pokročilý, expert), sbírání hvězdiček a odměnový systém. Běží na `iot.weeks.cz`, **momentálně není veřejně propagovaná** — zatím se na ni neodkazuje z `weeks.cz` ani odjinud.

Tento README je návod pro tebe, jak s tímhle projektem pracovat. Je psaný od nuly, předpokládá že jsi Git a GitHub nepoužíval. Pokud něco nedává smysl, napiš.

---

## První nastavení (uděláš jednou)

1. **Nainstaluj VS Code** (pokud ještě nemáš): https://code.visualstudio.com — výchozí instalátor, klikej Next.
2. **Nainstaluj Git pro Windows**: https://git-scm.com/download/win — stáhne se `.exe`, při instalaci nech **všechno default**, klikej Next. Git umožní VS Code komunikovat s GitHubem.
3. **Přihlas se do VS Code pomocí GitHubu** (jen jednou):
   - Otevři VS Code
   - Klikni na ikonu **účtu** úplně vlevo dole
   - Vyber "Sign in with GitHub"
   - V prohlížeči odsouhlas přístup
4. **Naklonuj tento projekt** (stáhne ho k sobě do počítače):
   - Ve VS Code stiskni `Ctrl+Shift+P`, napiš "Git: Clone" a Enter
   - Vlož URL: `https://github.com/lxkask/weeks-iot`
   - Vyber složku, kam to uložit. Doporučuju `C:\Users\[tvé jméno]\weeks-iot`
   - Až to skončí, VS Code se zeptá "Open the cloned repository?" → **Ano, otevřít**
5. **Ujisti se, že jsi na správném branchi:**
   - V **levém dolním rohu** VS Code vidíš název aktuálního branche
   - **Musí tam být `dev`**
   - Pokud tam je `main`, klikni na to, v nabídce nahoře vyber `dev`

Hotovo, teď můžeš pracovat.

## Jak si projekt pustit u sebe v počítači

Je to statický web (jen HTML, CSS, JavaScript), takže nic se nekompiluje. Dvě možnosti, jak to otevřít:

**Nejjednodušší (stačí):**
- Otevři soubor `index.html` ve File Exploreru → dvojklik → otevře se v prohlížeči

**Lepší (doporučené):**
- Ve VS Code nainstaluj rozšíření **Live Server** (ikona "Extensions" vlevo → vyhledej "Live Server" od Ritwick Dey → Install)
- Pak klikni pravým na `index.html` → "Open with Live Server"
- Vše se automaticky obnovuje, když soubor uložíš

## Jak pracovat na změnách (tohle budeš dělat 90 % času)

**1. Před začátkem práce stáhni nejnovější verzi ze serveru.**

Ve VS Code klikni na ikonu **Source Control** (třetí shora v levém panelu, vypadá jako rozvětvení). Nahoře klikni na tři tečky `...` → **Pull**. Tím se k tobě stáhne, co mezitím přibylo.

**2. Uprav co potřebuješ** v HTML / JS / CSS / assets.

**3. Zkontroluj svoje změny.**

V Source Control panelu vidíš **seznam změněných souborů**. Klikni na soubor, abys viděl diff (zelené = přidané řádky, červené = smazané).

**4. Přidej změny ke commitu.**

Vedle každého souboru je `+` (stage this change). Klikni na něj u souborů, které chceš zahrnout. Nebo klikni `+` vedle "Changes" pro všechny naráz.

**5. Napiš commit message.**

Nahoře v Source Control panelu je textové pole. Napiš krátce česky, co jsi udělal. Příklady:

- `Opravil jsem překlep v druhém úkolu`
- `Přidal jsem nový úkol na blikání dvou LED`
- `Změnil jsem barvu hvězdiček`

**6. Commit.**

Klikni zelené tlačítko **Commit** nahoře v Source Control.

**7. Pošli změny na GitHub.**

Nahoře se objeví modré tlačítko **Sync Changes** (nebo "Push"). Klikni.

**Co se stane pak:** za cca 30 sekund Vercel automaticky nasadí tvoji změnu na preview URL. Produkce (`iot.weeks.cz`) se **nezmění**, dokud to nemergnu do `main` (viz níže).

## Kam se koukat na svůj deploy (preview URL)

Každý push na `dev` spustí Vercel, který udělá preview deploy.

1. Otevři https://github.com/lxkask/weeks-iot/commits/dev
2. U tvého commitu vidíš buď oranžové kolečko (buildí se), zelenou fajfku (hotovo) nebo červený křížek (rozbito)
3. Klikni na fajfku → v rozbaleném seznamu najdi řádek `Vercel – Preview` → klikni `Details`
4. Tím se dostaneš na URL typu `https://weeks-iot-git-dev-lxkask.vercel.app`
5. **Tato URL je stabilní** (nemění se mezi deploye na `dev`) — můžeš si ji uložit do záložek

Preview URL se chová úplně stejně jako produkce, je to jen pro tebe a tým.

## Jak to dostat do "produkce" (na iot.weeks.cz)

**NEDĚLEJ sám.** Produkci (`main` branch) jsem chránil, aby tam nešlo nic omylem pushnout. Postup:

1. Otevři https://github.com/lxkask/weeks-iot
2. Nahoře klikni záložku **Pull requests** → **New pull request**
3. Nastav: `base: main` ← `compare: dev` (mělo by být default, ale zkontroluj)
4. Klikni **Create pull request**
5. Nahoře napiš výstižný titulek (česky je OK), dole popis co tam je nového
6. Klikni **Create pull request** (ten dole napravo)
7. **Napiš mi** (Lukáš) — WhatsApp / mail / telefon — že je PR k review
8. Projedu to, napíšu připomínky nebo schválím a udělám **Merge**
9. Po mergi se za ~30 sekund nová verze objeví na `iot.weeks.cz`

## Co když něco pokazím

Neboj se. Na `dev` branchi nemůžeš rozbít produkci. Kdykoli se něco pokazí:

- **Ideální první krok:** napiš mi a projdeme to spolu.
- **Revert na GitHubu:** otevři poslední commit na `dev` → tři tečky vpravo → "Revert". Vytvoří to nový commit, který undo-ne předchozí.
- **Smazal jsi něco lokálně a nevíš co dál:** neuděj nic dalšího a napiš mi. `dev` na GitHubu máš pořád nedotčený, stačí to stáhnout.

## Co do tohoto repa NEDÁVAT

- Hesla, API klíče, cokoli citlivého (nemáme `.env` — pokud ho vytvoříš, `.gitignore` ho ignoruje)
- Velké binární soubory (>10 MB) — pokud máš, zeptej se
- Osobní data dětí — platforma má fungovat bez nich (jen lokální progress v prohlížeči)

## Napojení potvrzovacího e-mailu

Po založení/propojení e-mailového účtu umí frontend zavolat backend endpoint, který odešle potvrzovací zprávu. Při mountu předej URL aplikace a endpoint:

```js
window.IotCampScreen.mount("#app", {
  accountAccessUrl: "https://iot.weeks.cz",
  accountCreatedEmailEndpoint: "/api/iot-account-created-email",
});
```

Endpoint dostane `POST` JSON s poli `to`, `subject`, `body` a `accessUrl`. Pokud hostující web nechce endpoint, může místo toho předat funkci `sendAccountCreatedEmail(message)`.

## CLI reference (pro zvědavé, není nutné)

Tytéž akce jako výše, jen v terminálu (VS Code má terminál pod ``Ctrl+` ``):

```bash
# Stáhni nejnovější
git pull

# Ukaž, co se změnilo
git status

# Stage vše
git add .

# Commit
git commit -m "popis změny"

# Push
git push

# Přepnout branch (kdybys nechtěně byl na main)
git checkout dev
```

## Když máš otázku

Nejsou hloupé otázky. Raději se zeptej než zkoušej naslepo.
