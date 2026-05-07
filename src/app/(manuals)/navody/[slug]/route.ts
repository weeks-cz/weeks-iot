import { getProgrammingGuide } from "@/features/programming-guides/guides";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TARGET_URL = "https://weeks.cz/";
const NFC_GUIDE_SLUG = "nfc-prepis-cipu";
const CONFETTI_JSON_TEXT = readFileSync(
  join(process.cwd(), "Confetti.json"),
  "utf8",
);
const LOTTIE_PLAYER_SCRIPT = readFileSync(
  join(
    process.cwd(),
    "node_modules",
    "three",
    "examples",
    "jsm",
    "libs",
    "lottie_canvas.module.js",
  ),
  "utf8",
).replaceAll("</script>", "<\\/script>");

type NfcOptionId = "kontakt" | "web" | "poloha";

type NfcReference = {
  label: string;
  href: string;
  note: string;
};

type NfcAppScreen = {
  title: string;
  subtitle: string;
  actions: string[];
  highlightIndex: number;
};

type NfcStep = {
  title: string;
  body: string;
  note?: string;
  screen?: NfcAppScreen;
};

type NfcOption = {
  id: NfcOptionId;
  label: string;
  icon: string;
  summary: string;
  steps: NfcStep[];
  references: NfcReference[];
};

type NfcGuide = {
  slug: string;
  title: string;
  welcome: string;
  intro: string;
  appReason: string;
  downloadReturn: string;
  warningItems: string[];
  storeLinks: {
    appStore: string;
    googlePlay: string;
  };
  options: NfcOption[];
};

const NFC_GUIDE: NfcGuide = {
  slug: NFC_GUIDE_SLUG,
  title: "Přepiš si NFC čip",
  welcome:
    "Jsem rád, že sis na tenhle čip vzpomněl. Tenhle návod je schválně krátký a měl by ti zabrat zhruba 5 minut.",
  intro:
    "NFC čip umí uložit malý kousek dat, který telefon po přiložení hned přečte. Tady si ukážeme, jak do něj v aplikaci NFC Tools uložit kontakt, web nebo polohu, aby se na jiném telefonu rovnou otevřel.",
  appReason:
    "Pro přeprogramování budeme používat aplikaci NFC Tools, protože je jednoduchá, funguje na iPhonu i Androidu a umí přesně ty typy záznamů, které pro tenhle čip potřebujeme.",
  downloadReturn:
    "Po stažení se sem vrať. Popup zůstane otevřený, takže stačí appku nainstalovat a pak pokračovat dalším krokem tady.",
  warningItems: [
    "Přepis nahradí to, co je na čipu uložené teď.",
    "Čip musí být zapisovatelný a nesmí být zamčený.",
    "Při zápisu nech telefon chvíli v klidu přímo u čipu.",
  ],
  storeLinks: {
    appStore: "https://apps.apple.com/us/app/nfc-tools/id1252962749",
    googlePlay:
      "https://play.google.com/store/apps/details?id=com.wakdev.wdnfc",
  },
  options: [
    {
      id: "kontakt",
      label: "Kontakt",
      icon: "K",
      summary:
        "Ulož na čip kontaktní kartu, aby si ji druhý telefon mohl hned otevřít a uložit.",
      steps: [
        {
          title: "Otevři zápis",
          body: "Po otevření aplikace přejdi do sekce Write. Tady se připravuje to, co se bude na čip zapisovat.",
          note: "Kdybys ses ztratil, hledej dole nebo nahoře záložku Write.",
          screen: {
            title: "NFC Tools",
            subtitle: "Vyber část aplikace, kde se připravuje zápis",
            actions: ["Read", "Write", "Tasks", "Other"],
            highlightIndex: 1,
          },
        },
        {
          title: "Přidej nový záznam",
          body: "V sekci Write tapni na Add a record. Tím řekneš aplikaci, co přesně má čip po načtení udělat.",
          screen: {
            title: "Write",
            subtitle: "Nejdřív se vytváří záznam, až potom se zapisuje",
            actions: ["Add a record", "Erase tags", "Write / 0 Bytes"],
            highlightIndex: 0,
          },
        },
        {
          title: "Vyber kontakt",
          body: "Ze seznamu vyber Contact / VCARD. To je typ záznamu, který umí otevřít kontaktní kartu na jiném telefonu.",
          screen: {
            title: "Add a record",
            subtitle: "Hledej typ záznamu pro kontakt",
            actions: ["Text", "URL / URI", "Contact / VCARD", "Address"],
            highlightIndex: 2,
          },
        },
        {
          title: "Vyplň údaje",
          body: "Vyplň jméno, telefon, e-mail a případně další údaje, které chceš na čip uložit. Nemusí to být všechno, stačí to, co opravdu chceš sdílet.",
          note: "Když si nejsi jistý, začni jen jménem a telefonem.",
          screen: {
            title: "Contact / VCARD",
            subtitle: "Vyplň jen údaje, které chceš předat dál",
            actions: ["Full name", "Phone", "Email", "Save"],
            highlightIndex: 3,
          },
        },
        {
          title: "Spusť zápis",
          body: "Po uložení záznamu se vrať do sekce Write a tapni na Write / X Bytes. Tím odstartuješ samotné zapsání na čip.",
          screen: {
            title: "Write",
            subtitle: "Jakmile je záznam připravený, zapiš ho na čip",
            actions: ["Add a record", "Write / X Bytes", "Cancel"],
            highlightIndex: 1,
          },
        },
        {
          title: "Přilož telefon k čipu",
          body: "Přilož telefon k NFC čipu a počkej na potvrzení dokončení. Po úspěšném zápisu by měl jiný telefon kontakt rovnou otevřít.",
          note: "Drž telefon chvíli v klidu, ať se zápis nepřeruší.",
          screen: {
            title: "Ready to scan",
            subtitle: "Teď už jen přiložit telefon k NFC čipu",
            actions: ["Hold near tag", "Writing...", "Done"],
            highlightIndex: 0,
          },
        },
      ],
      references: [
        {
          label: "NFC Tools for iPhone",
          href: "https://www.wakdev.com/en/apps/nfc-tools-ios.html",
          note: "Oficiální přehled aplikace a podporovaných typů záznamů.",
        },
        {
          label: "App Store",
          href: "https://apps.apple.com/us/app/nfc-tools/id1252962749",
          note: "Stažení aplikace pro iPhone.",
        },
      ],
    },
    {
      id: "web",
      label: "Web",
      icon: "W",
      summary:
        "Ulož na čip webovou adresu, aby se po přiložení telefonu otevřel odkaz.",
      steps: [
        {
          title: "Otevři zápis",
          body: "Po otevření aplikace přejdi do sekce Write. Odtud se připravuje každý nový obsah pro čip.",
          screen: {
            title: "NFC Tools",
            subtitle: "Otevři část aplikace pro zápis",
            actions: ["Read", "Write", "Tasks", "Other"],
            highlightIndex: 1,
          },
        },
        {
          title: "Přidej nový záznam",
          body: "Tapni na Add a record, aby sis vybral typ informace, kterou chceš na čip uložit.",
          screen: {
            title: "Write",
            subtitle: "Nejdřív založ nový záznam",
            actions: ["Add a record", "Erase tags", "Write / 0 Bytes"],
            highlightIndex: 0,
          },
        },
        {
          title: "Vyber webovou adresu",
          body: "Ze seznamu vyber URL / URI. Tahle volba řekne telefonu, že má po načtení otevřít odkaz.",
          screen: {
            title: "Add a record",
            subtitle: "Pro odkaz vyber URL / URI",
            actions: ["Text", "URL / URI", "Contact / VCARD", "Address"],
            highlightIndex: 1,
          },
        },
        {
          title: "Vlož odkaz",
          body: "Vlož webovou adresu, kterou chceš po načtení čipu otevřít, a záznam ulož.",
          note: "Nejbezpečnější je vložit celou adresu včetně `https://`.",
          screen: {
            title: "URL / URI",
            subtitle: "Sem patří přesná webová adresa",
            actions: ["https://...", "Validate", "Save"],
            highlightIndex: 2,
          },
        },
        {
          title: "Spusť zápis",
          body: "Po uložení se vrať do sekce Write a tapni na Write / X Bytes. Tím se připravený odkaz zapíše na čip.",
          screen: {
            title: "Write",
            subtitle: "Teď už stačí spustit samotný zápis",
            actions: ["Add a record", "Write / X Bytes", "Cancel"],
            highlightIndex: 1,
          },
        },
        {
          title: "Přilož telefon k čipu",
          body: "Přilož telefon k NFC čipu a počkej na potvrzení dokončení. Po načtení čipu by se měl web otevřít rovnou.",
          screen: {
            title: "Ready to scan",
            subtitle: "Přilož telefon k čipu a počkej",
            actions: ["Hold near tag", "Writing...", "Done"],
            highlightIndex: 0,
          },
        },
      ],
      references: [
        {
          label: "How to write a link on an NFC chip",
          href: "https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-write-a-link-url-on-an-nfc-chip.html",
          note: "Oficiální postup WAKDEV pro zápis URL.",
        },
        {
          label: "Google Play",
          href: "https://play.google.com/store/apps/details?id=com.wakdev.wdnfc",
          note: "Stažení aplikace pro Android.",
        },
      ],
    },
    {
      id: "poloha",
      label: "Poloha",
      icon: "P",
      summary:
        "Ulož na čip adresu nebo místo, aby telefon po načtení otevřel mapu se správnou polohou.",
      steps: [
        {
          title: "Otevři zápis",
          body: "Po otevření aplikace přejdi do sekce Write. Tady připravíš i záznam pro polohu nebo adresu.",
          screen: {
            title: "NFC Tools",
            subtitle: "Otevři část aplikace pro zápis",
            actions: ["Read", "Write", "Tasks", "Other"],
            highlightIndex: 1,
          },
        },
        {
          title: "Přidej nový záznam",
          body: "Tapni na Add a record. Tím otevřeš seznam typů informací, které se dají na čip zapsat.",
          screen: {
            title: "Write",
            subtitle: "Nejdřív založ nový záznam",
            actions: ["Add a record", "Erase tags", "Write / 0 Bytes"],
            highlightIndex: 0,
          },
        },
        {
          title: "Vyber adresu nebo polohu",
          body: "Ze seznamu vyber Address. Tahle volba je vhodná pro místo, adresu nebo lokaci otevřenou v mapách.",
          screen: {
            title: "Add a record",
            subtitle: "Pro polohu vyber Address",
            actions: ["Text", "URL / URI", "Contact / VCARD", "Address"],
            highlightIndex: 3,
          },
        },
        {
          title: "Zadej místo",
          body: "Zadej adresu, název místa nebo lokaci, kterou chceš otevřít po načtení čipu, a záznam ulož.",
          note: "Když chceš přesnější výsledek, zadej úplnou adresu.",
          screen: {
            title: "Address",
            subtitle: "Sem patří místo nebo adresa, která se má otevřít v mapách",
            actions: ["Street / place", "City", "Save"],
            highlightIndex: 2,
          },
        },
        {
          title: "Spusť zápis",
          body: "Po uložení záznamu se vrať do sekce Write a tapni na Write / X Bytes. Tím spustíš zápis na čip.",
          screen: {
            title: "Write",
            subtitle: "Teď už jen potvrdit zápis",
            actions: ["Add a record", "Write / X Bytes", "Cancel"],
            highlightIndex: 1,
          },
        },
        {
          title: "Přilož telefon k čipu",
          body: "Přilož telefon k NFC čipu a počkej na potvrzení. Po načtení čipu by se měla otevřít mapa se správnou polohou.",
          screen: {
            title: "Ready to scan",
            subtitle: "Přilož telefon k čipu a nech zápis doběhnout",
            actions: ["Hold near tag", "Writing...", "Done"],
            highlightIndex: 0,
          },
        },
      ],
      references: [
        {
          label: "How to create an NFC geotag",
          href: "https://www.wakdev.com/en/knowledge-base/how-to-guides/how-to-create-an-nfc-geotag.html",
          note: "Oficiální WAKDEV návod pro polohu a adresu.",
        },
        {
          label: "NFC Tools for iPhone",
          href: "https://www.wakdev.com/en/apps/nfc-tools-ios.html",
          note: "Ukázka aplikace, ve které adresu zapisuješ.",
        },
      ],
    },
  ],
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJsonForHtml(value: unknown) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function renderBaseStyles() {
  return `
      :root {
        color-scheme: dark;
        --bg-top: #08111f;
        --bg-bottom: #111b2d;
        --panel-border: rgba(255, 255, 255, 0.12);
        --shadow: 0 30px 100px rgba(0, 0, 0, 0.45);
        --nfc-accent: #f6a61c;
        --nfc-accent-soft: rgba(246, 166, 28, 0.14);
        --nfc-blue: #86d2ff;
        --nfc-text: #111827;
        --nfc-muted: rgba(71, 85, 105, 0.9);
        --nfc-panel: #ffffff;
        --nfc-panel-soft: #f8fafc;
        --nfc-border: rgba(15, 23, 42, 0.1);
      }

      * { box-sizing: border-box; }

      html, body {
        margin: 0;
        min-height: 100%;
        background: linear-gradient(180deg, var(--bg-top) 0%, var(--bg-bottom) 100%);
      }

      body {
        min-height: 100vh;
        overflow: hidden;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      .screen {
        position: relative;
        min-height: 100vh;
      }

      .site-preview {
        position: absolute;
        inset: 0;
        overflow: hidden;
        background: #0b1220;
        z-index: 0;
      }

      .preview-homepage-image {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
        transform: scale(1.02);
      }

      .preview-photo-overlay {
        position: absolute;
        inset: 0;
        background:
          linear-gradient(180deg, rgba(8, 17, 31, 0.12) 0%, rgba(8, 17, 31, 0.34) 100%),
          linear-gradient(90deg, rgba(10, 18, 32, 0.54) 0%, rgba(10, 18, 32, 0.24) 40%, rgba(10, 18, 32, 0.42) 100%);
      }

      .backdrop {
        position: absolute;
        inset: 0;
        z-index: 1;
        background:
          linear-gradient(180deg, rgba(3, 7, 18, 0.22), rgba(3, 7, 18, 0.52)),
          radial-gradient(circle at center, rgba(255, 255, 255, 0.03), transparent 55%);
        backdrop-filter: blur(3px);
        cursor: pointer;
      }

      .shell {
        position: relative;
        z-index: 2;
        min-height: 100dvh;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: max(20px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom));
        pointer-events: none;
      }

      .panel {
        width: min(100%, 1120px);
        height: min(88dvh, calc(100dvh - max(28px, env(safe-area-inset-top)) - max(12px, env(safe-area-inset-bottom))));
        min-height: 0;
        border: 1px solid var(--panel-border);
        border-radius: 32px 32px 0 0;
        background: #ffffff;
        box-shadow: var(--shadow);
        opacity: 1;
        pointer-events: auto;
      }

      .panel-empty {
        background: #ffffff;
      }

      @media (min-width: 768px) {
        .shell {
          padding: 48px 20px 0;
        }
      }

      @media (min-width: 1100px) {
        .shell {
          align-items: center;
          padding: 24px;
        }

        .panel {
          height: auto;
          max-height: 92vh;
          min-height: 0;
          border-radius: 32px;
        }
      }
  `;
}

function renderNfcStyles() {
  return `
      .panel-nfc {
        display: flex;
        flex-direction: column;
        min-height: 0;
        overflow: hidden;
        background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }

      .nfc-scroll {
        height: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
        color: var(--nfc-text);
      }

      .nfc-topbar {
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 14px;
        margin-bottom: 18px;
      }

      .nfc-title {
        margin: 12px 0 0;
        color: #0f172a;
        font-size: 30px;
        line-height: 1.05;
        letter-spacing: -0.04em;
      }

      .nfc-grid {
        display: grid;
        gap: 16px;
        flex: 1 1 auto;
        min-height: 0;
      }

      .nfc-stage,
      .nfc-reference-card {
        border-radius: 24px;
        border: 1px solid var(--nfc-border);
        background: var(--nfc-panel-soft);
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
      }

      .nfc-stage {
        display: flex;
        flex-direction: column;
        min-height: 0;
        padding: 20px;
        overflow: visible;
      }

      .nfc-stage-main {
        flex: 1 1 auto;
        padding-bottom: 16px;
      }

      .nfc-stage-lead {
        margin-bottom: 18px;
      }

      .nfc-hero-model-card {
        padding: 18px 18px 14px;
      }

      .nfc-hero-model-shell {
        position: relative;
        border-radius: 24px;
        overflow: hidden;
        background:
          radial-gradient(circle at top, rgba(134, 210, 255, 0.28), transparent 48%),
          linear-gradient(180deg, #dbeafe 0%, #eff6ff 42%, #f8fafc 100%);
        border: 1px solid rgba(37, 99, 235, 0.12);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.72),
          0 16px 36px rgba(37, 99, 235, 0.12);
      }

      .nfc-hero-model-shell::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 16px;
        width: 62%;
        height: 22px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: radial-gradient(circle, rgba(15, 23, 42, 0.2) 0%, rgba(15, 23, 42, 0) 72%);
        filter: blur(8px);
        pointer-events: none;
      }

      .nfc-hero-model {
        display: block;
        width: 100%;
        height: 320px;
        border: 0;
        background: transparent;
      }

      .nfc-hero-model-copy {
        margin-top: 12px;
        text-align: center;
      }

      .nfc-hero-model-copy strong {
        display: block;
        color: #0f172a;
        font-size: 14px;
      }

      .nfc-hero-model-copy span {
        display: block;
        margin-top: 4px;
        color: var(--nfc-muted);
        font-size: 13px;
        line-height: 1.45;
      }

      .nfc-stage-lead--celebration {
        position: fixed;
        inset: 0;
        margin: 0;
        pointer-events: none;
        overflow: hidden;
        z-index: 20;
      }

      .nfc-stage-image {
        display: block;
        width: 100%;
        max-width: 280px;
        margin: 0 auto;
        border-radius: 22px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: #ffffff;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }

      .nfc-stage-image--app {
        max-width: 108px;
        border: none;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        filter: drop-shadow(0 10px 18px rgba(15, 23, 42, 0.12));
      }

      .nfc-stage-image--screenshot {
        max-width: min(100%, 360px);
        border: none;
        border-radius: 12px;
        background: transparent;
        box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
      }

      .nfc-confetti {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }

      .nfc-confetti-lottie {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .nfc-confetti-lottie,
      .nfc-confetti-lottie canvas,
      .nfc-confetti-lottie svg {
        width: 100% !important;
        height: 100% !important;
        overflow: visible;
        display: block;
      }

      .nfc-stage h2 {
        margin: 0 0 10px;
        font-size: 22px;
        line-height: 1.2;
      }

      .nfc-stage p {
        margin: 0;
        color: var(--nfc-muted);
        line-height: 1.6;
      }

      .nfc-copy-list {
        margin: 0;
        padding-left: 22px;
        color: var(--nfc-text);
      }

      .nfc-copy-list li {
        line-height: 1.7;
      }

      .nfc-copy-list li::marker {
        color: #b45309;
      }

      .nfc-copy-list--muted {
        color: var(--nfc-muted);
      }

      .nfc-copy-list--compact {
        padding-left: 18px;
        font-size: 14px;
      }

      .nfc-copy-list--compact li {
        line-height: 1.45;
      }

      .nfc-stage-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 18px;
      }

      .nfc-stage-progress {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        color: #0f172a;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .nfc-stage-progress-label {
        flex: 0 0 auto;
      }

      .nfc-stage-track {
        flex: 1 1 auto;
        min-width: 104px;
        max-width: 180px;
        height: 6px;
        border-radius: 999px;
        overflow: hidden;
        background: rgba(37, 99, 235, 0.18);
      }

      .nfc-stage-track-fill {
        height: 100%;
        border-radius: inherit;
        background: #2563eb;
        transition: width 220ms ease;
      }

      .nfc-stage-card {
        border-radius: 22px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: #ffffff;
        padding: 18px;
      }

      .nfc-stage-card + .nfc-stage-card {
        margin-top: 14px;
      }

      .nfc-stage-card strong {
        color: var(--nfc-text);
      }

      .nfc-inline-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 18px;
      }

      .nfc-inline-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        appearance: none;
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 16px;
        min-height: 48px;
        padding: 0 16px;
        background: #ffffff;
        color: var(--nfc-text);
        text-align: center;
        line-height: 1.2;
        font-weight: 700;
        cursor: pointer;
      }

      .nfc-inline-button.is-primary {
        background: var(--nfc-accent);
        border-color: rgba(246, 166, 28, 0.55);
        color: #111827;
      }

      .nfc-store-grid,
      .nfc-reference-grid {
        display: grid;
        gap: 12px;
      }

      .nfc-store-grid {
        grid-template-columns: 1fr;
        align-items: stretch;
        margin-top: 0;
        gap: 8px;
      }

      .nfc-store-button {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid rgba(15, 23, 42, 0.1);
        background: #ffffff;
        color: var(--nfc-text);
        text-align: left;
      }

      .nfc-store-button strong,
      .nfc-reference-card strong {
        display: block;
      }

      .nfc-store-button span,
      .nfc-reference-card span {
        display: block;
        color: var(--nfc-muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .nfc-store-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 42px;
        height: 42px;
        padding: 0 12px;
        border-radius: 14px;
        background: rgba(246, 166, 28, 0.12);
        color: #b45309;
        font-weight: 800;
      }

      .nfc-store-button {
        display: block;
        padding: 0;
        border: none;
        background: transparent;
        box-shadow: none;
      }

      .nfc-store-button img {
        display: block;
        width: 100%;
        height: auto;
        border-radius: 0;
        box-shadow: none;
      }

      .nfc-inline-button:focus-visible,
      .nfc-store-button:focus-visible,
      .nfc-reference-card:focus-visible,
      .nfc-step-button:focus-visible {
        outline: 2px solid rgba(134, 210, 255, 0.95);
        outline-offset: 2px;
      }

      .nfc-step-titleline {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .nfc-step-stage {
        margin-top: 18px;
        border-radius: 22px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: #f8fafc;
        padding: 18px;
      }

      .nfc-step-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 14px;
      }

      .nfc-step-progress {
        color: #0f172a;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .nfc-step-track {
        flex: 1 1 auto;
        max-width: 180px;
        height: 6px;
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.24);
        overflow: hidden;
      }

      .nfc-step-track-fill {
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
      }

      .nfc-step-body {
        display: grid;
        grid-template-columns: 34px 1fr;
        gap: 12px;
        align-items: start;
      }

      .nfc-step-number {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.12);
        color: #0f172a;
        font-weight: 800;
        font-size: 14px;
      }

      .nfc-step-copy {
        padding-top: 4px;
        color: var(--nfc-text);
        line-height: 1.6;
        font-size: 16px;
      }

      .nfc-step-nav {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex: 0 0 auto;
        margin-top: 14px;
        padding-top: 14px;
        padding-bottom: env(safe-area-inset-bottom);
        border-top: 1px solid rgba(15, 23, 42, 0.08);
        background: var(--nfc-panel-soft);
      }

      .nfc-step-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 1 1 0;
        appearance: none;
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 16px;
        min-height: 48px;
        min-width: 0;
        padding: 0 16px;
        background: #ffffff;
        color: var(--nfc-text);
        text-align: center;
        line-height: 1.2;
        font-weight: 700;
        cursor: pointer;
      }

      .nfc-step-button.is-primary {
        background: var(--nfc-accent);
        border-color: rgba(246, 166, 28, 0.55);
        color: #111827;
      }

      .nfc-step-button[disabled] {
        opacity: 0.38;
        cursor: not-allowed;
      }

      .nfc-step-hint {
        color: var(--nfc-muted);
        font-size: 13px;
        line-height: 1.5;
        text-align: center;
      }

      .nfc-reference-grid {
        margin-top: 18px;
      }

      .nfc-reference-card {
        display: block;
        padding: 16px;
      }

      .nfc-reference-eyebrow {
        display: inline-block;
        margin-bottom: 10px;
        color: #b45309;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .nfc-footer-note {
        margin-top: 16px;
        color: var(--nfc-muted);
        font-size: 13px;
        line-height: 1.6;
      }

      @media (min-width: 768px) {
        .nfc-scroll {
          padding: 28px 28px 34px;
        }

        .nfc-title {
          font-size: 42px;
        }

        .nfc-grid {
          gap: 16px;
        }

        .nfc-stage {
          min-height: 0;
        }

        .nfc-reference-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .nfc-hero-model {
          height: 380px;
        }
      }
  `;
}

function renderShellHtml(
  title: string,
  panelClassName: string,
  panelInnerHtml: string,
  extraStyles = "",
  extraScript = "",
) {
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${safeTitle} | Weeks</title>
    <style>
${renderBaseStyles()}
${extraStyles}
    </style>
  </head>
  <body>
    <div class="screen">
      <div class="site-preview" aria-hidden="true">
        <img class="preview-homepage-image" src="/weeks-homepage.png" alt="" />
        <div class="preview-photo-overlay"></div>
      </div>
      <div class="backdrop" onclick="window.location.href='${TARGET_URL}'" aria-hidden="true"></div>
      <div class="shell">
        <section class="panel ${panelClassName}" role="dialog" aria-modal="true" aria-label="${safeTitle}">
          ${panelInnerHtml}
        </section>
      </div>
    </div>
    ${extraScript}
  </body>
</html>`;
}

function renderEmptyPopupHtml(title: string) {
  return renderShellHtml(title, "panel-empty", "");
}

function renderNfcPopupInnerHtml(guide: NfcGuide) {
  const safeTitle = escapeHtml(guide.title);

  return `
    <div class="nfc-scroll">
      <div class="nfc-topbar">
        <div>
          <h1 class="nfc-title">${safeTitle}</h1>
        </div>
      </div>

      <div class="nfc-grid">
        <section class="nfc-stage" id="nfc-stage" aria-live="polite"></section>
      </div>
    </div>
  `;
}

function renderNfcPopupScript(guide: NfcGuide) {
  const guideJson = escapeJsonForHtml({
    title: guide.title,
    welcome: guide.welcome,
    intro: guide.intro,
    appReason: guide.appReason,
    downloadReturn: guide.downloadReturn,
    storeLinks: guide.storeLinks,
  });
  const confettiJson = CONFETTI_JSON_TEXT.replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");

  return `
    <script type="module">
      ${LOTTIE_PLAYER_SCRIPT}
      (() => {
        const guide = ${guideJson};
        const confettiAnimationData = ${confettiJson};
        const stage = document.getElementById("nfc-stage");
        if (!stage) return;

        const state = {
          stepIndex: 0,
        };
        let activeConfetti = null;

        function escapeHtmlValue(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        }

        function buildSteps() {
          return [
            {
              kind: "welcome",
              title: guide.title,
              body: guide.welcome,
              note: "",
            },
            {
              kind: "intro",
              title: "Co tenhle NFC čip umí",
              body: guide.intro,
              note: "",
              imageSrc: "/nfc-cip.png",
              imageAlt: "NFC čip",
            },
            {
              kind: "why-app",
              title: "Proč budeme používat NFC Tools",
              body: guide.appReason,
              note: "",
              imageSrc: "/nfcappicone.png",
              imageAlt: "NFC Tools logo",
              imageClassName: "nfc-stage-image--app",
            },
            {
              kind: "download",
              title: "Stáhni si aplikaci",
              body: guide.downloadReturn,
              note: "",
            },
            {
              kind: "image-step",
              title: "Povol NFC",
              body: "Pokud tě aplikace po otevření zastaví chybou, zapni si v telefonu NFC a potom se vrať zpět do NFC Tools.",
              note: "",
              imageSrc: "/nfcapp-error.jpg",
              imageAlt: "NFC Tools error screenshot",
              imageClassName: "nfc-stage-image--screenshot",
              imagePosition: "after-copy",
            },
            {
              kind: "image-step",
              title: "Otevři Write",
              body: "Na hlavní obrazovce otevři záložku Write. Právě tam se připravuje obsah, který potom nahraješ na čip.",
              note: "",
              imageSrc: "/nfcapp-home.jpg",
              imageAlt: "NFC Tools home screenshot",
              imageClassName: "nfc-stage-image--screenshot",
              imagePosition: "after-copy",
            },
            {
              kind: "image-step",
              title: "Přidej záznam",
              body: "V sekci Write klepni na Add a record. Tím aplikaci řekneš, jaký druh informace se má na čip uložit.",
              note: "",
              imageSrc: "/nfcapp-write.jpg",
              imageAlt: "NFC Tools write screenshot",
              imageClassName: "nfc-stage-image--screenshot",
              imagePosition: "after-copy",
            },
            {
              kind: "image-step",
              title: "Vyber typ záznamu",
              body: "Teď vyber typ záznamu, který chceš na čip uložit. Pro tenhle návod budeme pracovat hlavně s možnostmi Contact, URL a Address.",
              note: "",
              imageSrc: "/nfcapp-addrecord.jpg",
              imageAlt: "NFC Tools add record screenshot",
              imageClassName: "nfc-stage-image--screenshot",
              imagePosition: "after-copy",
            },
            {
              kind: "image-step",
              title: "Nahraj obsah na čip",
              body: "Jakmile budeš mít záznam připravený, klepni na Write a přilož telefon k čipu. Na čip se vejde jen 144 bytes. Pokud NFC Tools ukazuje víc, napiš obsah stručněji. Kdyby se obsah na čip vešel špatně, zjednoduš ho a zkus zápis znovu.",
              note: "",
              imageSrc: "/nfcapp-upload.jpg",
              imageAlt: "NFC Tools upload screenshot",
              imageClassName: "nfc-stage-image--screenshot",
              imagePosition: "after-copy",
            },
            {
              kind: "celebration",
              title: "Máš hotovo",
              body: "Čip je připravený. Až ho přiložíš k telefonu, měl by otevřít obsah, který jsi na něj právě zapsal.",
              note: "",
            },
          ];
        }

        function renderDownloadStep() {
          return ''
            + '<div class="nfc-stage-card">'
            +   '<div class="nfc-store-grid">'
            +     '<a class="nfc-store-button" href="' + guide.storeLinks.appStore + '" target="_blank" rel="noopener noreferrer">'
            +       '<img src="/app-store.png" alt="Download on the App Store" />'
            +     '</a>'
            +     '<a class="nfc-store-button" href="' + guide.storeLinks.googlePlay + '" target="_blank" rel="noopener noreferrer">'
            +       '<img src="/google-play.svg" alt="Get it on Google Play" />'
            +     '</a>'
            +   '</div>'
            + '</div>';
        }

        function renderStageLead(step) {
          if (step.kind === 'celebration') {
            return ''
              + '<div class="nfc-stage-lead nfc-stage-lead--celebration">'
              +   '<div class="nfc-confetti" aria-hidden="true">'
              +     '<div class="nfc-confetti-lottie" id="nfc-confetti-lottie"></div>'
              +   '</div>'
              + '</div>';
          }

          return '';
        }

        function syncCelebrationConfetti(step) {
          if (activeConfetti) {
            activeConfetti.destroy();
            activeConfetti = null;
          }

          if (step.kind !== "celebration") {
            return;
          }

          const container = document.getElementById("nfc-confetti-lottie");
          if (!container || typeof lottie === "undefined" || typeof lottie.loadAnimation !== "function") {
            return;
          }

          container.innerHTML = "";
          activeConfetti = lottie.loadAnimation({
            container,
            renderer: "canvas",
            loop: false,
            autoplay: true,
            animationData: JSON.parse(JSON.stringify(confettiAnimationData)),
            rendererSettings: {
              preserveAspectRatio: "xMidYMid meet",
              clearCanvas: true,
            },
          });
          if (activeConfetti && typeof activeConfetti.goToAndPlay === "function") {
            activeConfetti.goToAndPlay(0, true);
          }
        }

        function renderCopyList(text, muted = false) {
          return '<ul class="nfc-copy-list' + (muted ? ' nfc-copy-list--muted' : '') + '"><li>' + text + '</li></ul>';
        }

        function renderWelcomeStep() {
          return ''
            + '<div class="nfc-stage-card nfc-hero-model-card">'
            +   '<div class="nfc-hero-model-shell">'
            +     '<iframe class="nfc-hero-model" src="/nfc-model-viewer.html" title="3D model NFC klíčenky" loading="eager"></iframe>'
            +   '</div>'
            +   '<div class="nfc-hero-model-copy">'
            +     '<strong>Klepni na klíčenku a otoč ji</strong>'
            +     '<span>Můžeš ji i táhnutím prstu nebo myši prohlédnout ze všech stran.</span>'
            +   '</div>'
            + '</div>'
            + '<div class="nfc-stage-card">'
            +   '<div class="nfc-inline-actions">'
            +     '<button type="button" class="nfc-inline-button is-primary" data-wizard-action="next">Začít s návodem</button>'
            +   '</div>'
            + '</div>';
        }

        function renderImageStep(step) {
          const imageClassName = step.imageClassName ? ' ' + step.imageClassName : '';
          return ''
            + '<div class="nfc-stage-card">'
            +   '<div class="nfc-stage-lead">'
            +     '<img class="nfc-stage-image' + imageClassName + '" src="' + escapeHtmlValue(step.imageSrc) + '" alt="' + escapeHtmlValue(step.imageAlt) + '" />'
            +   '</div>'
            + '</div>';
        }

        function renderCelebrationStep() {
          return ''
            + '<div class="nfc-stage-card">'
            +   '<ul class="nfc-copy-list nfc-copy-list--compact">'
            +     '<li>Zajímá tě, co dalšího s námi zvládneš? Podívej se na naše stránky na další návody.</li>'
            +   '</ul>'
            +   '<div class="nfc-inline-actions">'
            +     '<a class="nfc-inline-button is-primary" href="${TARGET_URL}">Přejít na stránku</a>'
            +   '</div>'
            + '</div>';
        }

        function renderStageContent(step) {
          if (step.kind === "welcome") return renderWelcomeStep();
          if (step.kind === "download") return renderDownloadStep();
          if (step.kind === "celebration") return renderCelebrationStep();
          return '';
        }

        function renderStage() {
          const steps = buildSteps();
          const totalSteps = steps.length;
          const safeStepIndex = Math.max(0, Math.min(state.stepIndex, totalSteps - 1));
          state.stepIndex = safeStepIndex;
          const step = steps[safeStepIndex];
          const progressPercent = Math.round(((safeStepIndex + 1) / totalSteps) * 100);
          const prevLabel = 'Zpět';
          let nextLabel = 'Dále';
          const showStepNav = step.kind !== 'welcome' && step.kind !== 'celebration';
          if (step.kind === 'download') nextLabel = 'Mám nainstalováno';

          stage.innerHTML = ''
            + '<div class="nfc-stage-main">'
              + '<div class="nfc-stage-header">'
              +   '<div class="nfc-stage-progress">'
              +     '<span class="nfc-stage-progress-label">Krok ' + (safeStepIndex + 1) + ' z ' + totalSteps + '</span>'
              +     '<span class="nfc-stage-track" aria-hidden="true"><span class="nfc-stage-track-fill" style="width:' + progressPercent + '%"></span></span>'
              +   '</div>'
              + '</div>'
              + renderStageLead(step)
              + (step.imageSrc && step.imagePosition !== "after-copy" ? renderImageStep(step) : '')
              + '<h2>' + escapeHtmlValue(step.title) + '</h2>'
              + (step.body ? renderCopyList(step.body, true) : '')
              + (step.note ? '<p class="nfc-footer-note">' + escapeHtmlValue(step.note) + '</p>' : '')
              + (step.imageSrc && step.imagePosition === "after-copy" ? renderImageStep(step) : '')
              + renderStageContent(step)
            + '</div>'
            + (showStepNav
              ? '<div class="nfc-step-nav">'
                +   '<button type="button" class="nfc-step-button" data-step-action="prev"' + (safeStepIndex === 0 ? ' disabled' : '') + '>' + prevLabel + '</button>'
                +   '<button type="button" class="nfc-step-button is-primary" data-step-action="next"' + (safeStepIndex === totalSteps - 1 ? ' disabled' : '') + '>' + nextLabel + '</button>'
                + '</div>'
              : '');

          syncCelebrationConfetti(step);

          const prevButton = stage.querySelector('[data-step-action="prev"]');
          const nextButton = stage.querySelector('[data-step-action="next"]');
          const wizardActions = Array.from(stage.querySelectorAll('[data-wizard-action]'));

          if (prevButton) {
            prevButton.addEventListener("click", () => {
              if (state.stepIndex === 0) return;
              state.stepIndex -= 1;
              renderStage();
            });
          }

          if (nextButton) {
            nextButton.addEventListener("click", () => {
              if (state.stepIndex >= totalSteps - 1) return;
              state.stepIndex += 1;
              renderStage();
            });
          }

          wizardActions.forEach((action) => {
            action.addEventListener("click", () => {
              const actionType = action.getAttribute("data-wizard-action");
              if (actionType === "next" && state.stepIndex < totalSteps - 1) {
                state.stepIndex += 1;
                renderStage();
              }
            });
          });
        }

        renderStage();
      })();
    </script>
  `;
}

function renderNfcPopupHtml(guide: NfcGuide) {
  return renderShellHtml(
    guide.title,
    "panel-nfc",
    renderNfcPopupInnerHtml(guide),
    renderNfcStyles(),
    renderNfcPopupScript(guide),
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (slug === NFC_GUIDE.slug) {
    return new Response(renderNfcPopupHtml(NFC_GUIDE), {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const guide = getProgrammingGuide(slug);
  const title = guide?.title ?? "Speciální návod";

  return new Response(renderEmptyPopupHtml(title), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
