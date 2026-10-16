import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import ar from "./locales/ar.json"
import en from "./locales/en.json"

export const SUPPORTED_LANGUAGES = ["ar", "en"] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const defaultNS = "common"

export const resources = {
  ar: { common: ar },
  en: { common: en },
} as const

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "ar",
      supportedLngs: SUPPORTED_LANGUAGES,
      defaultNS,
      ns: [defaultNS],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
      },
      returnNull: false,
    })
}

export default i18n
