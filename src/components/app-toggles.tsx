/**
 * AppToggles — أزرار تبديل اللغة والمظهر للأغلفة الهيكلية (Shells).
 * بنية تحتية مشتركة — ليست عنصر تصميم صفحة.
 */

import { useTheme } from "next-themes"
import { Languages, Moon, Sun } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

export function AppToggles() {
  const { t, i18n } = useTranslation()
  const { resolvedTheme, setTheme } = useTheme()

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language?.startsWith("en") ? "ar" : "en")
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleLanguage}
        aria-label={t("language.label")}
      >
        <Languages />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        aria-label={t("theme.label")}
      >
        {resolvedTheme === "dark" ? <Sun /> : <Moon />}
      </Button>
    </div>
  )
}
