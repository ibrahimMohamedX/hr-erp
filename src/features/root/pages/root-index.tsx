/**
 * RootIndex — نقطة الدخول التمهيدية: حالة الإعداد المعماري وروابط المناطق.
 * صفحة هيكلية وليست تصميمية — تخضع للإحلال في مرحلة بناء الواجهات.
 */

import { Link, Navigate } from "react-router"
import { useTranslation } from "react-i18next"
import { CircleArrowRight, Database } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { appEnv } from "@/config/env"
import { homeRouteForRole, useSession } from "@/features/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/config"

export function RootIndexPage() {
  const { t } = useTranslation()
  const { session } = useSession()
  const supabaseReady = isSupabaseConfigured()

  // مسجّل بالفعل → توجه مباشرة لمنطقته (منصة أو شركة)
  if (session) {
    return <Navigate to={homeRouteForRole(session.profile.role)} replace />
  }

  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle className="font-display text-h3">
            {t("placeholders.root.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-body text-muted-foreground">
            {t("placeholders.root.description")}
          </p>

          <div className="flex items-center gap-2 font-mono text-label">
            <Database className="size-4" />
            <span dir="ltr">
              supabase: {supabaseReady ? "configured" : "not configured"}
            </span>
            <Badge variant={supabaseReady ? "default" : "secondary"}>
              {supabaseReady
                ? t("placeholders.envConfigured")
                : t("placeholders.envNotConfigured")}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/platform">
                {t("areas.platform")}
                <CircleArrowRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app">
                {t("areas.company")}
                <CircleArrowRight />
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/auth/login">{t("nav.auth.login")}</Link>
            </Button>
          </div>

          <p className="font-mono text-label text-muted-foreground">
            env.mode: {appEnv.mode} · docs/07-roadmap.md
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
