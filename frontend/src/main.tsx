import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./i18n";
import "./styles/index.css";
import { StoreProvider } from "./stores/StoreContext";

createRoot(document.getElementById("root")!).render(
  <StoreProvider>
    <App />
  </StoreProvider>,
);
  