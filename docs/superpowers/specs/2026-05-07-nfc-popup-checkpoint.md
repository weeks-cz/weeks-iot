# NFC Popup Checkpoint

> Stav k 2026-05-07  
> Ucel: lokalni zaloha aktualni rozpracovane verze pred dalsimi zasahy do 3D zobrazeni zetonu

---

## Shrnutí

Aktualni NFC popup bezi na URL:

- `/navody/nfc-prepis-cipu/`

Popup je porad renderovany jako standalone HTML dokument vraceny z App Router `route.ts`, ne jako klasicka React page.

Hotove a zachovane casti:

- mobilni popup shell nad fake pozadim `weeks.cz`
- klik mimo popup presmeruje na `https://weeks.cz/`
- linearni 10krokovy guide
- App Store / Google Play odkazy
- screenshotove kroky 5-9
- confetti finalni krok
- opraveny layout navigacnich tlacitek, aby se neorezavaly

Rozpracovana cast:

- v prvnim kroku je pripraveny prostor pro interaktivni 3D zeton
- aktualni implementace pouziva iframe na staticky viewer:
  - `/public/nfc-model-viewer.html`
  - model asset `/public/nfc.weeks.glb`
  - baked texture `/public/nfc.bake.png`
- podle posledniho manualniho testu se renderuje pozadi a wrapper, ale samotny zeton zatim neni videt

---

## Zdroj pravdy

Primarni implementacni soubory:

- [src/app/(manuals)/navody/[slug]/route.ts](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/src/app/(manuals)/navody/[slug]/route.ts>)
- [public/nfc-model-viewer.html](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfc-model-viewer.html>)

Relevantni assety:

- [public/nfc.weeks.glb](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfc.weeks.glb>)
- [public/nfc.bake.png](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfc.bake.png>)
- [public/nfc-cip.png](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfc-cip.png>)
- [public/nfcappicone.png](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcappicone.png>)
- [public/nfcapp-error.jpg](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcapp-error.jpg>)
- [public/nfcapp-home.jpg](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcapp-home.jpg>)
- [public/nfcapp-write.jpg](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcapp-write.jpg>)
- [public/nfcapp-addrecord.jpg](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcapp-addrecord.jpg>)
- [public/nfcapp-upload.jpg](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcapp-upload.jpg>)
- [public/app-store.png](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/app-store.png>)
- [public/google-play.svg](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/google-play.svg>)
- [public/weeks-homepage.png](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/weeks-homepage.png>)

Podpurne soubory:

- [Confetti.json](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/Confetti.json>)
- [docs/superpowers/specs/2026-05-05-nfc-popup-guide.md](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/docs/superpowers/specs/2026-05-05-nfc-popup-guide.md>)
- [docs/superpowers/plans/2026-05-05-nfc-popup-guide.md](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/docs/superpowers/plans/2026-05-05-nfc-popup-guide.md>)

---

## Aktuální chování

### Krok 1

- zobrazi nadpis a uvodni text
- renderuje kartu pro 3D viewer mezi textem a tlacitkem `Začít s návodem`
- iframe ceka staticky viewer z `/nfc-model-viewer.html`

### Krok 2-10

- zustavaji funkcni jako stepper
- screenshoty a navigace jsou zanesene v `renderStage()` + `buildSteps()`

### 3D viewer

Aktualni viewer je zamerne mimo Next App Router a bezi jako staticky HTML soubor, aby:

- nezasekaval dev route kompilaci
- byl lehci na refresh
- sel upravovat nezavisle na popup route

Aktualni technicky smer:

- `three.module.js` z CDN
- `GLTFLoader`
- `OrbitControls`
- manualni nasviceni
- klik ma prepinat polootoceni

---

## Známý problém

Aktualni blocker:

- popup se nacte
- karta a pozadi 3D vieweru se zobrazi
- samotny zeton neni v zaberu nebo se nevykresli viditelne

Podezrela mista pro dalsi zasah:

1. scale a recentrovani modelu v `public/nfc-model-viewer.html`
2. kamera a clipping plane
3. orientace modelu po importu z Blenderu
4. material / texture mapping po nacteni GLB

---

## Bezpečný návrat

Pokud by se dalsi pokus rozbil, vratit se nejdriv sem:

1. Zachovat `route.ts` jako zdroj popup struktury.
2. Zachovat `public/nfc-model-viewer.html` jako oddeleny 3D sandbox.
3. Nevracet se zpet k experimentu s App Router route pro `/model`.
4. Ladit nejdriv jen viewer HTML:
   - scale
   - camera position
   - root rotation
   - scene background

---

## Lokální ověření

Posledni potvrzene fungujici minimum:

- `npm run build` prochazi
- lokalni `/` i `/navody/nfc-prepis-cipu/` umi vratit `200`, kdyz neni zaseknuty dev server

Prakticka poznamka pro dalsi kolo:

- na tomhle Windows stroji se local preview casto zasekne
- nejspolehlivejsi bylo znovu pustit `npm run dev` a po timeoutu jen overit, ze route vraci `200`

