// 컴포넌트 테스트가 Testing Library와 userEvent를 가져오는 공통 진입점

import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

export * from "@testing-library/react";
export { userEvent };

export function render(ui: ReactElement, options?: RenderOptions) {
  return testingLibraryRender(ui, options);
}
