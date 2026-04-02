import { createBrowserRouter } from "react-router";
import AuthPage from "./pages/AuthPage";
import MainPage from "./pages/MainPage";
import HistoryPage from "./pages/HistoryPage";
import SettingsPage from "./pages/SettingsPage";
import DesignSystemPage from "./pages/DesignSystemPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AuthPage,
  },
  {
    path: "/app",
    Component: MainPage,
  },
  {
    path: "/history",
    Component: HistoryPage,
  },
  {
    path: "/settings",
    Component: SettingsPage,
  },
  {
    path: "/design-system",
    Component: DesignSystemPage,
  },
]);