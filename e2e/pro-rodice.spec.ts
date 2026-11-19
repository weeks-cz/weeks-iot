import { expect, test, type Page } from "@playwright/test";

/**
 * Stránka pro rodiče z reklamy (/pro-rodice).
 *
 * POZOR: lokální prostředí míří na ostrou databázi a ostrý Resend. Test proto
 * formulář NIKDY neodesílá a v prohlížeči zahodí každý požadavek, který není
 * čtení (zápis měření do Supabase, server action). Stránka se jen prohlíží.
 */

const LESSON_HREF = /\/kurz\/iot\/rozsvit-ledku\/?$/;
const SHOTS = "docs/superpowers/mockups/2026-11-19-pro-rodice";

/** Prohlížeč smí jen číst. Cokoli jiného než GET/HEAD se zahodí. */
async function readOnly(page: Page): Promise<string[]> {
  await page.route("**/*", (route) => {
    const method = route.request().method();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return route.continue();
    return route.abort();
  });
  /* Nesoulad HTML ze serveru a z prohlížeče = varianta podle zařízení by se
     vykreslila jinak, než jak ji server poslal. */
  const hydration: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /hydrat/i.test(msg.text())) hydration.push(msg.text());
  });
  return hydration;
}

async function dismissCookies(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Nastavení cookies" });
  /* Lišta naskočí až po hydrataci, chvíli se na ni počká. */
  await dialog.waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: "Odmítnout vše" }).click();
    await expect(dialog).toBeHidden();
  }
}

test("server HTML contains form and lesson link", async ({ request }) => {
  const response = await request.get("/pro-rodice/");
  expect(response.status()).toBe(200);
  const html = await response.text();

  // Bez JavaScriptu: formulář i cesta do lekce jsou v HTML ze serveru.
  expect(html).toMatch(/<form[^>]*>/);
  expect(html).toContain('name="email"');
  expect(html).toContain("Poslat odkaz na počítač");
  expect(html).toMatch(/href="\/kurz\/iot\/rozsvit-ledku\/?"/);
  // Čísla s jednotkou drží pohromadě.
  expect(html).toContain("20–30\u00a0minutách");
});

test("stránka se neindexuje", async ({ request }) => {
  const html = await (await request.get("/pro-rodice/")).text();
  const robots = html.match(/<meta name="robots" content="([^"]*)"/);
  expect(robots?.[1]).toContain("noindex");
});

/** Telefon: formulář nad „Přesto zkusit na telefonu“, odkaz vede do lekce 1. */
async function expectPhoneLayout(page: Page) {
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: /Nejlíp to jde na počítači s\smyší/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(main.getByRole("heading", { name: "Poslat odkaz na jiný počítač" })).toBeHidden();
  await expect(main.getByRole("link", { name: "Začít první lekci" })).toBeHidden();

  const submit = main.getByRole("button", { name: "Poslat odkaz na počítač" });
  const phone = main.getByRole("link", { name: /Přesto zkusit na telefonu/ });
  await expect(phone).toBeVisible();
  await expect(phone).toHaveAttribute("href", LESSON_HREF);

  const submitBox = await submit.boundingBox();
  const phoneBox = await phone.boundingBox();
  expect(submitBox && phoneBox && submitBox.y < phoneBox.y).toBe(true);
  // Formulář je hned v prvním výhledu, ne až pod videem.
  await expect(main.getByLabel(/e-mail/i)).toBeInViewport();
}

/** Počítač: první viditelné tlačítko je „Začít první lekci“, hned po načtení. */
async function expectDesktopLayout(page: Page) {
  const main = page.locator("main");
  await expect(main.getByRole("heading", { name: "Poslat odkaz na jiný počítač" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(main.getByRole("heading", { name: /Nejlíp to jde/ })).toBeHidden();
  await expect(main.getByRole("link", { name: /Přesto zkusit na telefonu/ })).toBeHidden();

  const lesson = main.getByRole("link", { name: "Začít první lekci" });
  await expect(lesson).toBeInViewport();
  await expect(lesson).toHaveAttribute("href", LESSON_HREF);

  const first = await main.evaluate((root) => {
    const ctas = [...root.querySelectorAll<HTMLElement>("a[href], button")].filter((el) => {
      if (el.closest('[aria-hidden="true"]')) return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    });
    ctas.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return ctas[0]?.textContent?.trim();
  });
  expect(first).toBe("Začít první lekci");
}

test("telefon: formulář je nad odkazem „Přesto zkusit na telefonu“", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "jen dotykové zařízení");
  const hydration = await readOnly(page);
  await page.goto("/pro-rodice/");
  expect(await page.evaluate(() => window.matchMedia("(pointer: coarse)").matches)).toBe(true);
  await expectPhoneLayout(page);
  expect(hydration).toEqual([]);
});

test("počítač: první viditelné tlačítko je „Začít první lekci“", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "jen počítač s myší");
  const hydration = await readOnly(page);
  await page.goto("/pro-rodice/");
  expect(await page.evaluate(() => window.matchMedia("(pointer: fine)").matches)).toBe(true);
  await expectDesktopLayout(page);
  expect(hydration).toEqual([]);
});

/* Bez JavaScriptu musí být rozvržení správně na obou zařízeních – o pořadí
   a textech rozhoduje CSS (`pointer-fine:`), skript nic neprohazuje. */
test.describe("bez JavaScriptu", () => {
  test.use({ javaScriptEnabled: false });

  test("rozvržení podle zařízení platí i bez skriptu", async ({ page }, testInfo) => {
    await readOnly(page);
    await page.goto("/pro-rodice/");
    if (testInfo.project.name === "mobile") await expectPhoneLayout(page);
    else await expectDesktopLayout(page);
  });
});

/* Snímky k posouzení textů. Pouští se jen na vyžádání:
   PRO_RODICE_SHOTS=1 npm run e2e -- pro-rodice */
test("snímky stránky pro posouzení", async ({ page }, testInfo) => {
  test.skip(!process.env.PRO_RODICE_SHOTS, "jen na vyžádání");
  await readOnly(page);
  await page.goto("/pro-rodice/");
  const heading =
    testInfo.project.name === "mobile"
      ? /Nejlíp to jde na počítači s\smyší/
      : "Poslat odkaz na jiný počítač";
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
  await dismissCookies(page);

  const width = testInfo.project.name === "mobile" ? 390 : 1280;
  if (testInfo.project.name === "chromium") await page.setViewportSize({ width, height: 800 });
  await page.screenshot({ path: `${SHOTS}/pro-rodice-${width}-vyhled.png` });

  /* `fullPage` v Chromiu přenastaví emulaci zařízení a telefon by se
     přepnul na variantu pro počítač. Celá stránka se proto fotí jako
     vysoké okno se zachovaným dotykem. */
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/pro-rodice-${width}.png` });
});
