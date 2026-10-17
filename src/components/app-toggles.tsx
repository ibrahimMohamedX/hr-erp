/**
 * AppToggles — أزرار اللغة وقائمة المظهر (dark / light / system).
 * قائمة بدل زر تبديل: وضوح أكبر + دعم "system" + علامة على الاختيار الحالي.
 * (guard ضد undefined قبل الـ mount — نمط next-themes القياسي)
 */

import { useEffect, useState } from "react"
import { useTheme, type Theme } from "next-themes"
import { Languages, Moon, Sun, SunMoon } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const THEME_OPTIONS: Array<{
  value: Theme
  icon: typeof Sun
}> = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: SunMoon },
]

export function AppToggles() {
  const { t, i18n } = useTranslation()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // بعد الـ mount فقط تقرأ next-themes قيمًا حقيقية
  useEffect(() => setMounted(true), [])

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language?.startsWith("en") ? "ar" : "en")
  }

  const CurrentThemeIcon =
    mounted && resolvedTheme === "dark" ? Sun : Moon

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        data-testid="language-toggle"
        onClick={toggleLanguage}
        aria-label={t("language.label")}
        title={t("language.label")}
      >
        <Languages />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            data-testid="theme-toggle"
            aria-label={t("theme.label")}
            title={t("theme.label")}
          >
            <CurrentThemeIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          {THEME_OPTIONS.map(({ value, icon: Icon }) => (
            <DropdownMenuItem
              key={value}
              data-testid={`theme-option-${value}`}
              onClick={() => setTheme(value)}
              className={
                mounted && theme === value
                  ? "bg-accent text-accent-foreground"
                  : undefined
              }
            >
              <Icon />
              {t(`theme.${value}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
