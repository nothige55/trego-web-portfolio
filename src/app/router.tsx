import { createBrowserRouter } from "react-router";

import App from "./app";

export const router = createBrowserRouter([
  {
    path: "/app",
    element: <App />,
  },
]);
