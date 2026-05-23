# NFC Guide Analytics Handoff

Tento handoff je pro route `/navody/nfc-prepis-cipu/`.

Aktuální stav:

- NFC návod běží jako samostatný `route.ts`
- horní ticker táborů je zatím naplněný placeholdery
- analytics je připravená jako integrační zadání pro další krok

## Co nastavit ve Vercelu

- `NEXT_PUBLIC_GA_MEASUREMENT_ID`
  - GA4 Measurement ID ve tvaru `G-XXXXXXXXXX`
  - když nebude nastavené, stránka má fungovat dál bez měření
- `NFC_GUIDE_CAMP_TERMS_FALLBACK_URL`
  - cílová URL pro kliky z horních bloků táborů
  - typicky konkrétní stránka s termíny na `weeks.cz`
- `NFC_GUIDE_CAMP_TERMS_FEED_URL`
  - volitelný JSON feed pro budoucí nahrazení placeholderů

## Doporučené GA4 eventy

Pro tenhle návod doporučuju měřit:

- `nfc_guide_start_click`
  - klik na `Začít s návodem`
- `nfc_guide_reached_pre_download`
  - zobrazení kroku těsně před stažením appky
- `nfc_guide_store_click`
  - klik na App Store nebo Google Play
  - parametr `store: app_store | google_play`
- `nfc_guide_reached_penultimate_step`
  - uživatel se prokliká na předposlední krok
- `nfc_guide_reached_final_step`
  - uživatel se prokliká na poslední krok
- `nfc_guide_camp_terms_click`
  - klik na blok tábora v horním tickeru

## Doporučené parametry eventů

- `step_id`
- `store`
- `term_id`
- `placement`

`placement` doporučuju držet aspoň jako:

- `ticker`
- `hero`
- `final_cta`

## Co založit v GA4

V GA4:

`Admin` → `Custom definitions` → `Create custom dimensions`

Vytvořit event-scoped dimenze:

- `step_id`
- `store`
- `term_id`
- `placement`

## Jak to ověřit po zapojení

1. Nastavit env proměnné ve Vercelu.
2. Udělat redeploy.
3. Otevřít `/navody/nfc-prepis-cipu/`.
4. V GA4 `DebugView` zkontrolovat page view.
5. Projít celý flow až do posledního kroku.
6. Kliknout na store odkazy a na horní bloky táborů.
