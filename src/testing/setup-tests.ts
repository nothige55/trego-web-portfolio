// Vitest setupFiles로 jest-dom matcher를 등록하고 테스트마다 렌더링 결과를 정리

import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
