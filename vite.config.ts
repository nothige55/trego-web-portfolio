/// <reference types="vitest/config" />

import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    proxy: {
      "/api": {
        changeOrigin: true,
        secure: false,
        target: "http://localhost:3000",
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/testing/setup-tests.ts",
  },
});
