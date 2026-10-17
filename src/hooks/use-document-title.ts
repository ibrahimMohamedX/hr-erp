/**
 * useDocumentTitle — عنوان المتصفح يتحدث مع كل صفحة ولغة.
 * "لوحة الشركة · أركاي HR" — نقطة UX صغيرة تصنع فرقًا في الاحترافية.
 */

import { useEffect } from "react"
import { useTranslation } from "react-i18next"

export function useDocumentTitle(sectionTitle?: string) {
  const { t } = useTranslation()

  useEffect(() => {
    const appName = `${t("app.name")} HR`
    document.title = sectionTitle
      ? `${sectionTitle} · ${appName}`
      : `${appName} — ${t("app.tagline")}`
  }, [sectionTitle, t])
}
