/**
 * LoginPlaceholder — صفحة تسجيل دخول هيكلية.
 * 🔌 TODO (مرحلة الربط): نموذج دخول فعلي عبر Supabase Auth
 *    (signInWithPassword + onAuthStateChange داخل SessionProvider).
 */

import { useTranslation } from "react-i18next"
import { CircleArrowRight, LogIn } from "lucide-react"
import { Link } from "react-router"

import { AppToggles } from "@/components/app-toggles"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function LoginPlaceholderPage() {
  const { t } = useTranslation()

  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display">
              {t("auth.loginTitle")}
            </CardTitle>
            <AppToggles />
          </div>
          <CardDescription>{t("auth.loginDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-body text-muted-foreground">
            {t("placeholders.futurePhase")}
          </p>
          <Button variant="outline" asChild>
            <Link to="/">
              {t("common.back")}
              <CircleArrowRight className="rotate-180" />
            </Link>
          </Button>
          <p className="flex items-center gap-2 font-mono text-label text-muted-foreground">
            <LogIn className="size-3.5" />
            supabase.auth (future)
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
