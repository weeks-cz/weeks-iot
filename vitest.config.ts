import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    /* Node je výchozí schválně. Doménová logika jsdom nepotřebuje, je s ním
       výrazně pomalejší a jeho závislost @asamuzakjp/css-color padá na
       ERR_REQUIRE_ESM. jsdom se zapíná jen tam, kde se opravdu renderuje. */
    environment: "node",
    environmentMatchGlobs: [["src/**/__tests__/**/*.test.tsx", "jsdom"]],
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.tsx"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@legacy": path.resolve(__dirname, "src/legacy"),
    },
  },
});
