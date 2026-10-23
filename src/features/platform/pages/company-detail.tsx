/**
 * تفاصيل شركة — مركز العمليات في نموذج "مشروع مستقل لكل شركة":
 *   * كارت المشروع: ref/region/حالة البنية/اتصال مُتحقق + عمليات
 *     (تحقق · استعادة اتصال · إيقاف/تشغيل البنية · إعادة توفير) بمهام مباشرة.
 *   * كارت الاشتراك (منتجنا): خطة ومدة وتفعيل/تعليق/تجديد —
 *     منفصل تمامًا عن البنية التحتية.
 */

import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router"
import { toast } from "sonner"
import {
  CalendarRange,
  CircleArrowRight,
  Database,
  HardDrive,
  KeyRound,
  PauseCircle,
  PlayCircle,
  PlugZap,
  RefreshCw,
  ShieldAlert,
  UsersRound,
  UserSquare2,
} from "lucide-react"

import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { JobProgress } from "@/features/platform/components/job-progress"
import {
  ConnectionBadge,
  PlanBadge,
  SubscriptionBadge,
  TenantStatusBadge,
} from "@/features/platform/components/status-badges"
import {
  useCompany,
  useCompanyAction,
  usePlatformMode,
  useSubscriptionUpdate,
} from "@/features/platform/data/queries"
import type { SubscriptionPlanKey } from "@/types"

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-sm">{value}</span>
    </div>
  )
}

export function PlatformCompanyDetailPage() {
  const { t } = useTranslation()
  const { tenantId } = useParams<{ tenantId: string }>()
  const { data: company, isLoading } = useCompany(tenantId ?? "")
  const companyAction = useCompanyAction()
  const subscriptionUpdate = useSubscriptionUpdate()
  const mode = usePlatformMode()

  const [actionJobId, setActionJobId] = useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanKey>("starter")

  const runAction = (action: "verify" | "reconnect" | "pause_infra" | "resume_infra" | "reprovision") => {
    if (!tenantId) return
    companyAction.mutate(
      { companyId: tenantId, action },
      {
        onSuccess: (jobId) => setActionJobId(jobId),
        onError: (err: Error) => toast.error(err.message),
      },
    )
  }

  const applySubscription = (
    update: "activate" | "suspend" | "renew" | "change_plan",
    plan?: SubscriptionPlanKey,
  ) => {
    if (!tenantId) return
    subscriptionUpdate.mutate({
      company_id: tenantId,
      action: update,
      plan,
      duration_months: 12,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("platform.companyDetail.notFound")} />
        <Button asChild variant="outline">
          <Link to="/platform/companies">
            <CircleArrowRight className="rtl:rotate-180" />
            {t("nav.platform.companies")}
          </Link>
        </Button>
      </div>
    )
  }

  const isConnected = company.connection_state === "connected"

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description={t("platform.companyDetail.description")}
        actions={
          <Button asChild variant="outline">
            <Link to="/platform/companies">
              <CircleArrowRight className="rtl:rotate-180" />
              {t("common.back")}
            </Link>
          </Button>
        }
      />

      <DemoBanner />

      {/* ─── كارت المشروع المستقل ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Database className="size-4 text-primary" />
            {t("provisioning.projectCard")}
            {mode === "demo" ? (
              <Badge variant="outline" className="border-warn/40 text-[10px] text-warn">
                {t("demo.badge")}
              </Badge>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {company.project ? (
            <>
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                <div>
                  <InfoRow
                    label="Project ref"
                    value={
                      <span className="font-mono text-label" dir="ltr">
                        {company.project.ref}
                      </span>
                    }
                  />
                  <InfoRow
                    label="URL"
                    value={
                      <span className="font-mono text-label" dir="ltr">
                        {company.project.url || "—"}
                      </span>
                    }
                  />
                  <InfoRow
                    label={t("provisioning.region")}
                    value={
                      <span className="font-latin text-label" dir="ltr">
                        {company.project.region}
                      </span>
                    }
                  />
                </div>
                <div>
                  <InfoRow
                    label={t("provisioning.infraState")}
                    value={
                      <Badge
                        variant="outline"
                        className={
                          company.project.infra_state === "active"
                            ? "border-ok/40 text-ok"
                            : "border-warn/50 text-warn"
                        }
                      >
                        {t(`provisioning.infra.${company.project.infra_state}`)}
                      </Badge>
                    }
                  />
                  <InfoRow
                    label={t("provisioning.connection")}
                    value={<ConnectionBadge state={company.connection_state} />}
                  />
                  <InfoRow
                    label="anon key"
                    value={
                      company.project.anon_key_set ? (
                        <span className="flex items-center gap-1 text-ok">
                          <KeyRound className="size-3" />
                          {t("provisioning.keyStored")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )
                    }
                  />
                  <InfoRow
                    label={t("provisioning.lastVerified")}
                    value={
                      company.project.last_verified_at
                        ? new Date(company.project.last_verified_at).toLocaleString(
                            "ar-EG",
                          )
                        : t("provisioning.neverVerified")
                    }
                  />
                </div>
              </div>

              <Separator />

              {/* ─── أول مدير للشركة (دعوة بريد) ─────────────────────────── */}
              <Separator />
              <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
                <InfoRow
                  label={t("provisioning.adminEmail")}
                  value={
                    <span className="font-mono text-label" dir="ltr">
                      {company.admin_email}
                    </span>
                  }
                />
                <InfoRow
                  label={t("provisioning.adminInviteStatus")}
                  value={
                    company.admin_invited_at ? (
                      <Badge variant="outline" className="border-ok/40 text-[11px] text-ok">
                        {t("provisioning.adminInvited")} ·{" "}
                        {new Date(company.admin_invited_at).toLocaleDateString("ar-EG")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-warn/40 text-[11px] text-warn">
                        {t("provisioning.adminNotInvited")}
                      </Badge>
                    )
                  }
                />
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAction("verify")}
                  disabled={companyAction.isPending}
                >
                  <PlugZap className="size-4" />
                  {t("provisioning.verifyAction")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => runAction("reconnect")}
                  disabled={companyAction.isPending}
                >
                  <RefreshCw className="size-4" />
                  {t("provisioning.reconnectAction")}
                </Button>
                {company.project.infra_state === "paused" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAction("resume_infra")}
                    disabled={companyAction.isPending}
                  >
                    <PlayCircle className="size-4" />
                    {t("provisioning.resumeInfra")}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runAction("pause_infra")}
                    disabled={companyAction.isPending}
                  >
                    <PauseCircle className="size-4" />
                    {t("provisioning.pauseInfra")}
                  </Button>
                )}

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <ShieldAlert className="size-4" />
                      {t("provisioning.reprovisionAction")}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {t("provisioning.reprovisionTitle")}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t("provisioning.reprovisionDescription")}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => runAction("reprovision")}
                      >
                        {t("common.confirm")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {actionJobId ? (
                <JobProgress
                  jobId={actionJobId}
                  onSucceeded={() => {
                    toast.success(t("provisioning.succeededToast"))
                    setActionJobId(null)
                  }}
                  onFailed={() => toast.error(t("provisioning.failedToast"))}
                />
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("provisioning.noProjectDetail")}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAction("reprovision")}
                disabled={companyAction.isPending}
              >
                <RefreshCw className="size-4" />
                {t("provisioning.reprovisionAction")}
              </Button>
              {actionJobId ? <JobProgress jobId={actionJobId} /> : null}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── الاشتراك (منتجنا) — منفصل عن البنية ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("nav.platform.subscriptions")}
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              {t("provisioning.subscriptionIsolatedNote")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {company.subscription ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <PlanBadge plan={company.subscription.plan} />
                <SubscriptionBadge status={company.subscription.status} />
                <span className="flex items-center gap-1.5 font-latin text-label text-muted-foreground">
                  <CalendarRange className="size-3.5" />
                  <span dir="ltr">
                    {company.subscription.current_period_start} →{" "}
                    {company.subscription.current_period_end}
                  </span>
                </span>
                <TenantStatusBadge status={company.status} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => applySubscription("activate")}
                  disabled={!isConnected || subscriptionUpdate.isPending}
                  title={
                    !isConnected ? t("provisioning.activateBlockedHint") : undefined
                  }
                >
                  {t("subscription.action.activate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySubscription("suspend")}
                  disabled={subscriptionUpdate.isPending}
                >
                  {t("subscription.action.suspend")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => applySubscription("renew")}
                  disabled={subscriptionUpdate.isPending}
                >
                  {t("subscription.action.renew")}
                </Button>

                <div className="ms-2 flex items-center gap-2">
                  <Select
                    value={selectedPlan}
                    onValueChange={(v) => setSelectedPlan(v as SubscriptionPlanKey)}
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["starter", "growth", "enterprise"] as SubscriptionPlanKey[]).map(
                        (plan) => (
                          <SelectItem key={plan} value={plan}>
                            {t(`subscription.plan.${plan}`)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => applySubscription("change_plan", selectedPlan)}
                    disabled={subscriptionUpdate.isPending}
                  >
                    {t("subscription.action.applyPlan")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
          )}
        </CardContent>
      </Card>

      {/* ─── الاستخدام ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t("table.users")}
          value={company.usage?.active_users ?? 0}
          icon={UsersRound}
          tone="arc"
        />
        <KpiCard
          title={t("table.employees")}
          value={company.usage?.employee_count ?? 0}
          icon={UserSquare2}
          tone="copper"
        />
        <KpiCard
          title={t("platform.companyDetail.storage")}
          value={`${Math.round((company.usage?.storage_used_mb ?? 0) / 102.4) / 10} GB`}
          icon={HardDrive}
          tone="neutral"
        />
        <KpiCard
          title={t("provisioning.companyStatus")}
          value={t(`entityStatus.${company.status}`)}
          icon={Database}
          tone={company.status === "active" ? "ok" : "warn"}
        />
      </div>
    </div>
  )
}
