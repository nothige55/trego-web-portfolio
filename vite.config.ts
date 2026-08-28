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
      "/ai": {
        changeOrigin: true,
        secure: false,
        target: "http://127.0.0.1:8787",
      },
      "/api": {
        changeOrigin: true,
        secure: false,
        target: "http://localhost:3000",
      },
      "/project": {
        changeOrigin: true,
        secure: false,
        target: "http://localhost:3000",
        ws: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/testing/setup-tests.ts",
  },
});
