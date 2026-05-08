# NFC Popup Checkpoint

> Stav k 2026-05-07  
> Ucel: lokalni zaloha aktualni funkcni verze NFC popupu a 3D vieweru po nasazeni na Vercel

---

## Shrnuti

Aktualni NFC popup bezi na URL:

- `/navody/nfc-prepis-cipu/`

Produkce je nasazovana na:

- `https://novy-projekt.vercel.app`

Popup je porad renderovany jako standalone HTML dokument vraceny z App Router `route.ts`, ne jako klasicka React page.

Hotove a zachovane casti:

- mobilni popup shell nad fake pozadim `weeks.cz`
- klik mimo popup presmeruje na `https://weeks.cz/`
- linearni 10krokovy guide
- App Store / Google Play odkazy
- screenshotove kroky 5-9
- confetti finalni krok
- opraveny layout navigacnich tlacitek, aby se neorezavaly
- v prvnim kroku je vlozeny funkcni interaktivni 3D viewer mezi text a tlacitko

Aktualni 3D stav:

- viewer bezi jako iframe na staticky soubor `/nfc-model-viewer.html`
- viewer nacita model `public/nfcweeks1.glb`
- aktualni verze modelu je brana z exportu uzivatele, bez dalsiho prepisu normals nebo roughness/metalness ve vieweru
- klik na model prepina predni a zadni stranu
- scena byla ztmavena a nasledne jemne zesvetlena tak, aby zustala bliz Blender preview

---

## Zdroj pravdy

Primarni implementacni soubory:

- [src/app/(manuals)/navody/[slug]/route.ts](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/src/app/(manuals)/navody/[slug]/route.ts>)
- [public/nfc-model-viewer.html](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfc-model-viewer.html>)

Relevantni assety:

- [public/nfcweeks1.glb](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/public/nfcweeks1.glb>)
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

## Aktualni chovani

### Krok 1

- zobrazi nadpis a uvodni text
- renderuje kartu pro 3D viewer mezi textem a tlacitkem `Zacit s navodem`
- iframe cte staticky viewer z `/nfc-model-viewer.html`
- uvnitr vieweru je stacionarni kamera, model je vycentrovany a klik prepina otoceni mezi stranami

### Krok 2-10

- zustavaji funkcni jako stepper
- screenshoty a navigace jsou zanesene v `renderStage()` + `buildSteps()`

### 3D viewer

Aktualni viewer je zamerne mimo Next App Router a bezi jako staticky HTML soubor, aby:

- nezasekaval dev route kompilaci
- byl lehci na refresh
- sel upravovat nezavisle na popup route

Aktualni technicky smer:

- `three.module.js` z CDN pres import map
- `GLTFLoader`
- stacionarni kamera
- manualni nasviceni s nizsi expozici
- klik preklapi model mezi stranami
- viewer uz neimportuje `OrbitControls`
- viewer uz neprepisuje materialove vlastnosti modelu, aby zustal vzhled co nejbliz Blender exportu

---

## Aktualni poznamky k vizualu

Posledni schvalene smerovani:

- pouzivat `nfcweeks1.glb` jako hlavni asset, protoze ma lepe pripraveny pivot
- shading ma jit primarne z exportu modelu, ne z agresivnich viewer hacku
- nasviceni ma byt jemnejsi, aby model nebyl prepalene svetly

Pokud bude potreba dalsi ladeni, prioritni poradi je:

1. doladit svetla a expozici ve vieweru
2. nemenit normals nebo material automaticky v JS, pokud to neni nutne
3. pri dalsi zmene modelu vzdy zkopirovat novou verzi do `public/nfcweeks1.glb`

---

## Bezpecny navrat

Pokud by se dalsi pokus rozbil, vratit se nejdriv sem:

1. Zachovat `route.ts` jako zdroj popup struktury.
2. Zachovat `public/nfc-model-viewer.html` jako oddeleny 3D sandbox.
3. Zachovat `public/nfcweeks1.glb` jako aktualni aktivni asset.
4. Ladit nejdriv jen viewer HTML:
   - exposure
   - light intensities
   - scale
   - tilt pivot

---

## Lokalni overeni

Posledni potvrzene fungujici minimum:

- `npm run build` prochazi
- produkce na Vercelu se po kazde uprave vieweru uspesne nasadila
- popup route i standalone viewer se overovaly hlavne pres produkci kvuli nestabilnimu lokalnimu preview na Windows

Prakticka poznamka pro dalsi kolo:

- na tomhle Windows stroji se local preview casto zasekne
- nejspolehlivejsi workflow byl:
  - upravit `public/nfc-model-viewer.html`
  - zkopirovat novy model do `public/nfcweeks1.glb`
  - pustit `npm run build`
  - nasadit `vercel --prod`
