import { useEffect, type ReactNode } from "react"
import { useTranslation } from "react-i18next"

/**
 * يزامن اتجاه الصفحة ولغتها مع اللغة المختارة.
 * العربية → RTL · الإنجليزية → LTR
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation()

  useEffect(() => {
    const language = i18n.language?.startsWith("en") ? "en" : "ar"
    const dir = i18n.dir(language)
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [i18n, i18n.language])

  return children
}
