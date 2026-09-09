import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";

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
    // 에이전트 워크트리가 프로젝트 루트 안에 생성되면 낡은 테스트 파일까지 수집된다.
    // 그 파일들은 @/ alias를 통해 루트 src를 읽으므로 검증 의미도 없다.
    exclude: [...configDefaults.exclude, "**/.claude/**", "**/.codex/**"],
    setupFiles: "./src/testing/setup-tests.ts",
  },
});
