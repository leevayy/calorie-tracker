import { createBrowserRouter, redirect } from "react-router";
import AuthPage from "./pages/AuthPage";
import AppTabShell from "./layout/AppTabShell";
import DesignSystemPage from "./pages/DesignSystemPage";
import { DEFAULT_APP_TAB_SEGMENT, isAppTabSegment } from "./navigation/appTabs";

export const router = createBrowserRouter([
  { path: "/", Component: AuthPage },
  { path: "/design-system", Component: DesignSystemPage },
  {
    path: "/:tab",
    Component: AppTabShell,
    loader: ({ params }) => {
      if (!isAppTabSegment(params.tab)) {
        return redirect(`/${DEFAULT_APP_TAB_SEGMENT}`);
      }
      return null;
    },
  },
]);
