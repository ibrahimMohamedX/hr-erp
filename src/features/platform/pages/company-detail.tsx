/**
 * تفاصيل شركة — البيانات الأساسية + الاشتراك + مؤشرات الاستخدام + المستخدمون.
 */

import { useTranslation } from "react-i18next"
import { Link, useParams } from "react-router"
import {
  ArrowLeftRight,
  CalendarRange,
  CircleArrowRight,
  Database,
  HardDrive,
  UsersRound,
  UserSquare2,
} from "lucide-react"

import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompany } from "@/features/platform/data/queries"
import {
  ConnectionBadge,
  PlanBadge,
  SubscriptionBadge,
  TenantStatusBadge,
} from "@/features/platform/components/status-badges"

export function PlatformCompanyDetailPage() {
  const { t } = useTranslation()
  const { tenantId } = useParams<{ tenantId: string }>()
  const { data: company, isLoading } = useCompany(tenantId ?? "")

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

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        description={`${t("platform.companyDetail.description")} — ${t("demo.badge")}`}
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

      {/* البيانات الأساسية */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("platform.companyDetail.coreData")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">Slug</dt>
              <dd className="font-mono text-sm" dir="ltr">
                {company.slug}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">
                {t("table.status")}
              </dt>
              <dd>
                <TenantStatusBadge status={company.status} />
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">
                {t("table.connection")}
              </dt>
              <dd>
                <ConnectionBadge state={company.connection_state} />
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">
                {t("platform.companyDetail.createdAt")}
              </dt>
              <dd className="font-latin text-sm" dir="ltr">
                {company.created_at.slice(0, 10)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* مؤشرات الاستخدام */}
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
          title={t("platform.companyDetail.lastActivity")}
          value={
            company.usage?.last_activity_at
              ? new Date(company.usage.last_activity_at).toLocaleDateString(
                  "ar-EG",
                )
              : "—"
          }
          icon={ArrowLeftRight}
          tone="ok"
        />
      </div>

      {/* الاشتراك */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("nav.platform.subscriptions")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {company.subscription ? (
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("table.plan")}
                </span>
                <PlanBadge plan={company.subscription.plan} />
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("table.status")}
                </span>
                <SubscriptionBadge status={company.subscription.status} />
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <span className="text-xs text-muted-foreground">
                  {t("subscription.seats")}
                </span>
                <span className="font-latin text-sm" dir="ltr">
                  {company.subscription.seats ?? "∞"}
                </span>
              </div>
              <div className="flex flex-col items-start gap-1.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarRange className="size-3" />
                  {t("subscription.period")}
                </span>
                <span className="font-latin text-sm" dir="ltr">
                  {company.subscription.current_period_start} →{" "}
                  {company.subscription.current_period_end}
                </span>
              </div>
              <Badge variant="secondary" className="gap-1">
                <Database className="size-3" />
                {t("demo.badge")}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("common.noData")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
