import { createInstance, type i18n } from "i18next";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

export function createI18n(language: string): i18n {
  const instance = createInstance({
    lng: language,
    fallbackLng: "en",
    supportedLngs: ["en", "ru"],
    resources: { en: { translation: en }, ru: { translation: ru } },
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  instance.init();
  return instance;
}
