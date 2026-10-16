/**
 * حالة النظام — مؤشرات تشغيلية أولية من مصادر حقيقية متاحة (إعدادات البيئة)
 * + بيانات تجريبية موسومة. لوحة المراقبة الفعلية مرحلة لاحقة.
 */

import { useTranslation } from "react-i18next"
import { CheckCircle2, Database, MinusCircle, ServerCog } from "lucide-react"

import { DemoBanner } from "@/components/demo-banner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { appEnv } from "@/config/env"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { useSession } from "@/features/auth/session"

function CheckRow({
  ok,
  label,
  value,
}: {
  ok: boolean
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="flex items-center gap-2 text-sm">
        {ok ? (
          <CheckCircle2 className="size-4 text-ok" />
        ) : (
          <MinusCircle className="size-4 text-warn" />
        )}
        {label}
      </span>
      <span className="font-mono text-label text-muted-foreground" dir="ltr">
        {value}
      </span>
    </div>
  )
}

export function PlatformSystemPage() {
  const { t } = useTranslation()
  const { isDemo } = useSession()
  const supabaseReady = isSupabaseConfigured()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.platform.system")}
        description={t("platform.system.description")}
      />

      <DemoBanner />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-primary" />
              Supabase
            </CardTitle>
            <CardDescription>
              {t("platform.system.supabaseDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CheckRow
              ok={supabaseReady}
              label={t("platform.system.envConfigured")}
              value={supabaseReady ? "VITE_SUPABASE_*" : "—"}
            />
            <CheckRow
              ok={false}
              label={t("platform.system.dbMigrated")}
              value="migrations: pending"
            />
            <CheckRow
              ok={false}
              label={t("platform.system.rlsPolicies")}
              value="RLS: pending"
            />
            <Separator className="my-3" />
            <p className="text-xs text-muted-foreground">
              {t("platform.system.hintDocs")}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ServerCog className="size-4 text-primary" />
              {t("platform.system.appRuntime")}
            </CardTitle>
            <CardDescription>
              {t("platform.system.appRuntimeDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CheckRow
              ok
              label="mode"
              value={appEnv.mode}
            />
            <CheckRow
              ok
              label="default theme"
              value={appEnv.defaultTheme}
            />
            <CheckRow
              ok
              label="default language"
              value={appEnv.defaultLanguage}
            />
            <Separator className="my-3" />
            <div className="flex items-center gap-2">
              <Badge variant="secondary">v0.2</Badge>
              <Badge
                variant="outline"
                className={
                  isDemo
                    ? "border-warn/40 text-warn"
                    : "border-ok/40 text-ok"
                }
              >
                {isDemo ? t("demo.badge") : "LIVE"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
