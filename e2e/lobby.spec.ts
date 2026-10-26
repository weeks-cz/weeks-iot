import { expect, test } from "@playwright/test";

/**
 * Průchod anonyma: vyřeší první lekci, uvidí malou oslavu, logo ho vrátí
 * na přehled kurzu s hero „Pokračovat“ a /ucim-se ho pošle k přihlášení.
 * Nezakládá účty, nepřihlašuje se a nic nezapisuje do databáze (postup
 * anonyma žije jen v localStorage prohlížeče, který je pro test čerstvý).
 */

test("anonym vyřeší první lekci a lobby ho vrátí k dalšímu kroku", async ({ page }) => {
  await page.goto("/kurz/iot/rozsvit-ledku/");
  await expect(page.getByRole("heading", { level: 1, name: "Rozsviť LEDku" })).toBeVisible({
    timeout: 60_000,
  });

  // Cookie lišta by mohla překrývat tlačítka; odmítnutí je bez následků.
  const cookies = page.getByRole("dialog", { name: "Nastavení cookies" });
  if (await cookies.isVisible().catch(() => false)) {
    await cookies.getByRole("button", { name: "Odmítnout vše" }).click();
  }

  // Zadání → Součástky → Zapojení.
  await page.getByRole("button", { name: /Jdu na to/ }).click();
  await page.getByRole("button", { name: /Jdu zapojovat/ }).click();
  await expect(page.getByRole("heading", { name: "Zapoj obvod" })).toBeVisible();

  // Nápovědy se musí vyčerpat, teprve pak se nabídne „Zapoj … za mě“.
  const wiringHint = page.getByRole("button", { name: /Nevím si rady|Poradit víc/ });
  while (await wiringHint.count()) {
    await wiringHint.first().click();
  }
  const assist = page.getByRole("button", { name: "Zapoj tenhle krok za mě" });
  const next = page.getByRole("button", { name: /Napsat program/ });
  for (let i = 0; i < 20 && !(await next.count()); i++) {
    await assist.click();
  }
  await next.click();

  // Výchozí jsou bloky; řešení se vkládá do textového editoru.
  await page.getByRole("button", { name: "Kód", exact: true }).click();

  // Program: nápovědy → „Ukázat řešení“ → „Vložit do editoru“ → Spustit.
  const codeHint = page.getByRole("button", { name: /Nevím si rady|Poradit víc/ });
  while (await codeHint.count()) {
    await codeHint.first().click();
  }
  await page.getByRole("button", { name: "Ukázat řešení" }).click();
  await page.getByRole("button", { name: "Vložit do editoru" }).click();
  await page.getByRole("button", { name: "Spustit", exact: true }).click();

  await page.getByRole("button", { name: /Mám hotovo/ }).click({ timeout: 30_000 });

  // Malá oslava: titulek lekce + „svítí.“ a amber „Další lekce“ bez účtu.
  await expect(page.getByRole("heading", { name: /Rozsviť LEDku\s*— a svítí\./ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("link", { name: /Další lekce/ })).toBeVisible();

  // Logo vede na přehled kurzu, kde po připojení naskočí hero „Pokračovat“ —
  // hned, bez znovunačtení: AnonHomeLink relaci odebírá.
  await page.getByRole("banner").getByRole("link", { name: "Weeks Učebna — domů" }).click();
  await expect(page).toHaveURL(/\/kurz\/iot\/?$/);
  // Hero AnonLobby, ne osnova pod ním: „Pokračovat lekcí 2“ v osnově se
  // vykreslí i tehdy, když AnonLobby vůbec nenaskočí.
  await expect(page.getByRole("heading", { level: 1, name: /Vítej zpátky/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("link", { name: /^Pokračovat v lekci/ })).toBeVisible();
});

test("/ucim-se bez přihlášení vede na přihlášení s návratem", async ({ page }) => {
  await page.goto("/ucim-se/");
  await expect(page).toHaveURL(/\/prihlaseni\/?\?next=%2Fucim-se/);
});
