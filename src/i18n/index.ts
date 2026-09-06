import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import am from "./locales/am.json";
import { useSettings } from "@/store/settingsStore";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    am: { translation: am },
  },
  lng: useSettings.getState().lang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Keep i18next in sync with the settings store.
useSettings.subscribe((s) => {
  if (i18n.language !== s.lang) i18n.changeLanguage(s.lang);
});

export default i18n;
