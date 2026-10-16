import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Route, Routes } from "react-router"
import { useTranslation } from "react-i18next"

import { I18nProvider } from "@/components/i18n-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

/**
 * نقطة تركيب البنية الأساسية فقط.
 * هيكل الصفحات والأقسام هيتبنى في المرحلة الجاية بعد توضيح
 * الـ structure وأنواع المستخدمين والصلاحيات.
 */

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/** Placeholder مؤقت للتحقق من عمل البيئة — ليس صفحة تصميمية. */
function EnvironmentCheck() {
  const { t, i18n } = useTranslation()

  const toggleLanguage = () => {
    void i18n.changeLanguage(i18n.language?.startsWith("en") ? "ar" : "en")
  }

  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="font-display text-h2 font-bold">
          {t("app.name")}
          <span className="text-primary"> HR</span>
        </h1>
        <p className="text-body text-muted-foreground">{t("app.tagline")}</p>
        <div className="flex gap-3">
          <Button onClick={toggleLanguage}>{t("language.switchTo")}</Button>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        defaultTheme="dark"
        themes={["dark", "light", "system"]}
        enableSystem
        disableTransitionOnChange
      >
        <I18nProvider>
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<EnvironmentCheck />} />
              </Routes>
            </BrowserRouter>
            <Toaster />
          </TooltipProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
