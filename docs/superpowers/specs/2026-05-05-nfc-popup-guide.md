# NFC Popup Guide Spec

> Stav k 2026-05-05  
> Kontext: samostatny popup screen nad fake prvnim pohledem `weeks.cz`

---

## Aktualni stav

V projektu existuje samostatny popup route renderovany jako ciste HTML, bez zavislosti na hlavni ucebne nebo React UI aplikace.

Soucasne chovani:

- popup bezi jako standalone route, ne jako soucast classroom flow
- pozadi je stylizovane jako prvni pohled `weeks.cz`
- klik mimo popup presmeruje uzivatele na `https://weeks.cz/`
- popup panel je plne nepruhledny a vizualne nad pozadim
- fake pozadi je klikaci, popup samotny klik nepropousti
- NFC guide ma vlastni slug `/navody/nfc-prepis-cipu/`

Technicka poznamka:

- `weeks.cz` nelze embeddovat do iframe, protoze vraci `X-Frame-Options: DENY`
- pozadi je tedy staticka rekonstrukce prvniho hero screenu, ne live embed
- route zustava jako App Router `route.ts`, ne `page.tsx`

Relevantni misto implementace:

- [src/app/(manuals)/navody/[slug]/route.ts](</c:/Users/stepa/Desktop/weeks/iot/novy-projekt/src/app/(manuals)/navody/[slug]/route.ts>)

---

## Produktovy cil

Cely ucel popup okna je, aby si uzivatel po nacteni NFC cipu otevrel specialni stranku s jednoduchym navodem, jak ten cip prepsat pro vlastni ucel v aplikaci NFC Tools.

Uzivatel ma byt schopen:

- pochopit velmi jednoduse, co NFC cip dela
- stahnout si NFC Tools na iPhone nebo Android
- vratit se po stazeni zpet na popup stranku, aniz by se zavrela
- dostat navod po jednotlivych krocich
- mezi kroky chodit pres jasna tlacitka `Zpet` a `Dale`, ne pres dlouhy scroll
- projit kratky obecny navod bez rozboceni na varianty

---

## Schvaleny plan

### Summary

Build a dedicated popup URL for NFC tag rewriting, separate from the current placeholder route, using the same standalone HTML-route approach as the existing popup shell. The popup stays visually on top of the fake `weeks.cz` first screen, clicking outside still redirects to `https://weeks.cz/`, and the inside of the popup is a fixed 10-step mobile-first NFC Tools guide shown one step at a time via `Zpet` / `Dale`.

### Implementation Changes

- Add a dedicated slug for the NFC flow at `/navody/nfc-prepis-cipu/`, while keeping the current generic placeholder route untouched.
- Keep the popup implementation isolated from the main app UI and CSS: continue using the standalone route-rendered HTML approach so this screen does not depend on the classroom app, React state, or other app bundles.
- Replace the empty popup body with a structured, mobile-first wizard flow:
  - exactly 10 steps total
  - step 1: welcome
  - step 2: NFC explainer with `/nfc-cip.png`
  - step 3: "why NFC Tools" with `/nfcappicone.png`
  - step 4: app download with `App Store` and `Google Play` buttons
  - step 5: enable NFC if needed with `/nfcapp-error.jpg`
  - step 6: open `Write` with `/nfcapp-home.jpg`
  - step 7: tap `Add a record` with `/nfcapp-write.jpg`
  - step 8: choose record type with `/nfcapp-addrecord.jpg`
  - step 9: write/upload with `/nfcapp-upload.jpg`
  - step 10: done/confirmation with animated confetti, a short 144 Bytes limit warning, and a link button labelled `Prejit na stranku`
- Make the store buttons open externally without closing the popup page:
  - use direct store links
  - open with `target="_blank"` and `rel="noopener noreferrer"`
  - keep the popup page intact so the user can return after install
- Use generic instructions only, with no on-page form fields and no variant selection step.
- Add explicit step navigation inside the selected guide:
  - `Zpet` returns to the previous step
  - `Dale` advances to the next step
  - the current progress is always visible, for example `Krok 2 z 6`
- Make the whole experience linear, not just the final option detail:
  - the user should click through the introduction too
  - the option-specific tutorial begins only after the common setup steps
- Add a small "before you write" warning block:
  - rewriting replaces existing tag content
  - the chip must be writable and not locked
  - keep the phone still while writing
- Add a tiny "how NFC works" explainer in plain Czech:
  - NFC chip stores small data
  - phone reads it when brought close
  - here the goal is to save a contact, website, or location so another phone opens it immediately
- Keep the popup panel fully opaque and above the background exactly as it is now.
- Preserve current outside-click behavior exactly:
  - outside popup = redirect to `https://weeks.cz/`
  - inside popup = no redirect

### Public Interfaces / Content Model

- Introduce a dedicated content model for this route instead of hardcoding all copy inline:
  - route title
  - welcome copy
  - store links
  - NFC intro copy
  - return-after-download copy
  - three option cards with label, icon, short summary
  - per-option step list
  - per-option official reference links
  - warning copy
- No new backend API is needed.
- No new user input fields are needed in v1.
- No change to the classroom app routes or auth/session behavior.

### External References

- Use official NFC Tools sources as the default content source:
  - App Store: `https://apps.apple.com/us/app/nfc-tools/id1252962749`
  - Google Play: `https://play.google.com/store/apps/details?id=com.wakdev.wdnfc`
  - URL writing guide: `https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-write-a-link-url-on-an-nfc-chip.html`
  - Geolocation/address guide: `https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-create-an-nfc-geotag.html`
  - app overview for contact-capable write types: `https://www.wakdev.com/en/apps/nfc-tools-ios.html`
- Default decision for v1:
  - keep all provided NFC Tools screenshots in the shared 10-step wizard
  - prioritize clear step text and official reference links first
  - do not include `Kontakt`, `Web`, `Poloha` branching in this flow

### Test Plan

- Manual mobile test at iPhone and Android widths:
  - popup opens centered/anchored correctly above the fake `weeks.cz` first screen
  - popup content is readable without desktop-only assumptions
  - outside click still redirects to the top of `https://weeks.cz/`
- Store link behavior:
  - `App Store` and `Google Play` buttons open externally in a new tab/context
  - current popup page remains available when the user returns
- Step navigation:
  - tapping `Dale` advances exactly one step
  - tapping `Zpet` returns exactly one step
  - first step has disabled `Zpet`
  - last step has disabled `Dale`
  - current progress like `Krok 2 z 6` is visible
- Content correctness:
  - NFC explainer is short and understandable
  - steps match the official NFC Tools flow
  - warning copy is visible before the write action
- Isolation/regression:
  - route returns `200`
  - page still works even if the classroom app has unrelated dependency issues
  - popup layering remains correct and fully opaque

### Assumptions

- This NFC guide gets its own URL and does not replace the current generic placeholder route.
- The page is instructional only; users do not enter their own contact/site/location data on the page itself.
- Both store buttons are always shown; platform detection is not required in v1.
- The guide does not cover password protection, locking tags, or advanced NFC Tools automation in v1.
- Redirect outside the popup goes to the homepage top state of `https://weeks.cz/`, not to a deeper anchor or restored scroll position.

---

## Dulezita rozhodnuti z konverzace

- obsah popupu ma byt mobile-first
- popup je samostatny screen, ne realny modal nad live webem
- klik mimo popup ma presmerovat na `weeks.cz`
- pro NFC cast ma vzniknout nova samostatna URL
- navod bude obecny, bez formulare pro vlastni data primo na strance
- guide ma byt step-by-step, ne dlouhy scroll jednoho seznamu
- guide ma mit presne 10 kroku a pouziva obrazky: cip v kroku 2, logo NFC Tools v kroku 3, screenshoty aplikace v krocich 5-9

---

## Doporuceny dalsi krok

Pri navazani na tuto cast pokracovat takto:

1. Udrzet samostatny slug pro NFC popup.
2. Drzet texty a strukturu v dedikovanem content modelu.
3. Renderovat detail jako stepper s `Zpet` / `Dale`.
4. Udrzovat pevne 10krokove flow bez kroku s vyberem variant.
5. Otestovat cele chovani primarne na mobilu.
