import { expect, test } from "@playwright/test";

/**
 * Smoke test: návštěvník dojde od úvodní stránky k první lekci a na
 * registraci. Záměrně nedokončuje lekci — obvod se skládá přes vnitřní
 * stav editoru, který se dál mění, a test by se rozbíjel při každé
 * úpravě. Dokončení lekce pokrývají jednotkové testy `lessons.test.ts`.
 */

test("úvodní stránka vede na první lekci", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Weeks/);

  await page.getByRole("link", { name: "Zkusit první lekci" }).first().click();

  // Dev server kompiluje stránku lekce až při prvním návštěvě — proto delší limit.
  await expect(page).toHaveURL(/\/kurz\/iot\/rozsvit-ledku\/?$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Rozsviť LEDku" })).toBeVisible({ timeout: 30_000 });
});

test("registrace je dostupná a ukazuje formulář", async ({ page }) => {
  await page.goto("/registrace/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /založit|pokračovat|registrovat/i }).first()).toBeVisible();
});

test("neexistující stránka vrací české 404", async ({ page }) => {
  const response = await page.goto("/tahle-stranka-neexistuje/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Tuhle stránku jsme nenašli" })).toBeVisible();
});

test("legacy tábor je vypnutý bez TABOR_ENABLED", async ({ page }) => {
  const response = await page.goto("/tabor/");
  expect(response?.status()).toBe(404);
});

test("cookie lišta se ukáže a bez souhlasu neodejde žádné měření", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    if (/googletagmanager|google-analytics|connect\.facebook|facebook\.com\/tr/.test(req.url())) {
      external.push(req.url());
    }
  });

  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Nastavení cookies" });
  await expect(dialog).toBeVisible({ timeout: 30_000 });
  await dialog.getByRole("button", { name: "Odmítnout vše" }).click();
  await expect(dialog).toBeHidden();

  // Po odmítnutí se nesmí načíst ani GA, ani Pixel.
  await page.waitForTimeout(1_000);
  expect(external).toEqual([]);
});

test("přihlášení a obnova hesla se vykreslí bez účtu", async ({ page }) => {
  await page.goto("/prihlaseni/");
  await expect(page.getByRole("heading", { level: 1, name: "Přihlášení" })).toBeVisible();
  await expect(page.getByLabel("Heslo")).toBeVisible();

  await page.goto("/obnova-hesla/");
  await expect(page.getByRole("heading", { level: 1, name: "Zapomenuté heslo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Poslat odkaz" })).toBeVisible();
});

test("chráněný /ucet přesměruje na přihlášení s návratem", async ({ page }) => {
  await page.goto("/ucet/");
  await expect(page).toHaveURL(/\/prihlaseni\/?\?next=%2Fucet/);
});

test("neznámý kód chyby na přihlášení nevyhodí stránku", async ({ page }) => {
  const response = await page.goto("/prihlaseni/?chyba=constructor");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Přihlášení" })).toBeVisible();
});
