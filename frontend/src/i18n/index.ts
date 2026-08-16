import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import pl from "./locales/pl.json";
import ru from "./locales/ru.json";
import kk from "./locales/kk.json";
import tt from "./locales/tt.json";
import {
  coercePreferredLanguage,
  initialPreferredLanguage,
  persistPreferredLanguage,
} from "@/utils/preferredLanguage";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  tt: { translation: tt },
  pl: { translation: pl },
  kk: { translation: kk },
} as const;

export function syncLocaleEnvironment(code: string): void {
  const language = coercePreferredLanguage(code);
  persistPreferredLanguage(language);
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.title = resources[language].translation.main.title;
}

const initialLanguage = initialPreferredLanguage();
syncLocaleEnvironment(initialLanguage);
i18n.on("languageChanged", syncLocaleEnvironment);

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage,
  fallbackLng: "en",
  supportedLngs: Object.keys(resources),
  load: "languageOnly",
  nonExplicitSupportedLngs: true,
  interpolation: { escapeValue: false },
});

export default i18n;
