import { createBrowserRouter } from "react-router";

import { NotFoundRoute } from "@/app/routes/not-found-route";
import { PlannerRoute } from "@/app/routes/planner-route";
import { RootRoute } from "@/app/routes/root-route";
import { RouteError } from "@/app/routes/route-error";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRoute />,
    errorElement: <RouteError />,
  },
  {
    path: "/demo",
    lazy: async () => ({ Component: (await import("@/app/routes/demo-route")).DemoRoute }),
    errorElement: <RouteError />,
  },
  {
    path: "/planner/:projectId/:projectTitle?",
    element: <PlannerRoute />,
    errorElement: <RouteError />,
  },
  {
    path: "*",
    element: <NotFoundRoute />,
  },
]);
