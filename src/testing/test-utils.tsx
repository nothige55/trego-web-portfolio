import { render as testingLibraryRender, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

export * from "@testing-library/react";
export { userEvent };

export function render(ui: ReactElement, options?: RenderOptions) {
  return testingLibraryRender(ui, options);
}
