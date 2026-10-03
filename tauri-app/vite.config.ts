/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    css: false,
    // e2e/ holds Playwright specs (npm run test:e2e); Vitest must not load them
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: "localhost",
    hmr: {
      host: "localhost",
      port: 1420,
    },
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});