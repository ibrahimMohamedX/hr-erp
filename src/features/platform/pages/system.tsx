/**
 * حالة النظام — مؤشرات حقيقية من مصادر متاحة (إعدادات البيئة) +
 * حالة الـ Control Plane (live/demo) وقائمة الأسرار المطلوبة على الخادم فقط.
 */

import { useTranslation } from "react-i18next"
import {
  CheckCircle2,
  Database,
  KeySquare,
  MinusCircle,
  ServerCog,
} from "lucide-react"

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
import { isPlatformBackendConfigured } from "@/lib/platform/client"
import { usePlatformMode } from "@/features/platform/data/queries"
import { useSession } from "@/features/auth/session"

function CheckRow({
  ok,
  label,
  value,
  hint,
}: {
  ok: boolean
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="flex min-w-0 items-center gap-2 text-sm">
        {ok ? (
          <CheckCircle2 className="size-4 shrink-0 text-ok" />
        ) : (
          <MinusCircle className="size-4 shrink-0 text-warn" />
        )}
        <span className="min-w-0">
          {label}
          {hint ? (
            <span className="block text-[11px] text-muted-foreground">{hint}</span>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 font-mono text-label text-muted-foreground" dir="ltr">
        {value}
      </span>
    </div>
  )
}

export function PlatformSystemPage() {
  const { t } = useTranslation()
  const { isDemo } = useSession()
  const supabaseReady = isSupabaseConfigured()
  const platformReady = isPlatformBackendConfigured()
  const mode = usePlatformMode()

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.platform.system")}
        description={t("platform.system.description")}
      />

      <DemoBanner />

      {/* ─── الـ Control Plane ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <ServerCog className="size-4 text-primary" />
            {t("platform.system.controlPlaneTitle")}
            <Badge
              variant="outline"
              className={
                mode === "live"
                  ? "border-ok/40 text-ok"
                  : "border-warn/40 text-warn"
              }
            >
              {mode === "live" ? "LIVE" : t("demo.badge")}
            </Badge>
          </CardTitle>
          <CardDescription>
            {t("platform.system.controlPlaneDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-x-10 md:grid-cols-2">
          <div>
            <CheckRow
              ok={platformReady}
              label={t("platform.system.platformEnv")}
              value={platformReady ? "VITE_PLATFORM_SUPABASE_*" : "—"}
              hint={t("platform.system.clientSafeHint")}
            />
            <CheckRow
              ok={false}
              label="SUPABASE_ACCESS_TOKEN"
              value={t("platform.system.serverSecret")}
              hint={t("platform.system.managementApiHint")}
            />
            <CheckRow
              ok={false}
              label="SUPABASE_ORG_ID"
              value={t("platform.system.serverSecret")}
              hint={t("platform.system.orgHint")}
            />
          </div>
          <div>
            <CheckRow
              ok={false}
              label="SUPABASE_SERVICE_ROLE_KEY"
              value={t("platform.system.serverSecret")}
              hint={t("platform.system.serviceRoleHint")}
            />
            <CheckRow
              ok={false}
              label="PROVISION_REGION"
              value={t("platform.system.serverSecret")}
              hint={t("platform.system.regionHint")}
            />
            <CheckRow
              ok={mode === "live"}
              label={t("platform.system.edgeDeployed")}
              value={mode === "live" ? "tenant-admin" : "—"}
              hint={t("platform.system.edgeHint")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-primary" />
              {t("platform.system.projectsCard")}
            </CardTitle>
            <CardDescription>
              {t("platform.system.projectsCardDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CheckRow
              ok={supabaseReady}
              label={t("platform.system.envConfigured")}
              value={supabaseReady ? "VITE_SUPABASE_*" : "—"}
            />
            <CheckRow
              ok={mode === "live"}
              label={t("platform.system.dbMigrated")}
              value={mode === "live" ? "control plane" : "pending"}
            />
            <CheckRow
              ok={mode === "live"}
              label={t("platform.system.rlsPolicies")}
              value={mode === "live" ? "RLS: on" : "RLS: pending"}
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
              <KeySquare className="size-4 text-primary" />
              {t("platform.system.appRuntime")}
            </CardTitle>
            <CardDescription>
              {t("platform.system.appRuntimeDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CheckRow ok label="mode" value={appEnv.mode} />
            <CheckRow ok label="default theme" value={appEnv.defaultTheme} />
            <CheckRow ok label="default language" value={appEnv.defaultLanguage} />
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
