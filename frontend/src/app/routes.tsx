import { createBrowserRouter, redirect } from "react-router";
import AuthPage from "./pages/AuthPage";
import AppTabShell from "./layout/AppTabShell";
import DesignSystemPage from "./pages/DesignSystemPage";

const TAB_IDS = ["app", "history", "settings"] as const;

export const router = createBrowserRouter([
  { path: "/", Component: AuthPage },
  { path: "/design-system", Component: DesignSystemPage },
  {
    path: "/:tab",
    Component: AppTabShell,
    loader: ({ params }) => {
      if (!TAB_IDS.includes(params.tab as (typeof TAB_IDS)[number])) {
        return redirect("/app");
      }
      return null;
    },
  },
]);
