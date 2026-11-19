import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke test.
 *
 *   npm run e2e                       # spustí dev server na :3000
 *   BASE_URL=http://localhost:3102 npm run e2e   # běžící server (nic nespouští)
 *
 * Test jen čte. Nezakládá účty a nic nezapisuje do databáze.
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    locale: "cs-CZ",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    /* Telefon s prstem (`pointer: coarse`) – jen pro stránku pro rodiče,
       která se podle zařízení přeskládá. Ostatní testy počítají s myší.
       Rozměry a dotyk iPhonu, ale v Chromiu: WebKit na Windows nenačte
       přes http://localhost styly (CSP `upgrade-insecure-requests`). */
    {
      name: "mobile",
      testMatch: /pro-rodice\.spec\.ts/,
      use: { ...devices["iPhone 14"], browserName: "chromium" },
    },
  ],
  // Vlastní server se spouští jen tehdy, když BASE_URL není nastavené.
  ...(process.env.BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
