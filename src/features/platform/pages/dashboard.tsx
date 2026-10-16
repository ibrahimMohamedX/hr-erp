/**
 * Dashboard المنصة — أول شاشة حقيقية للـ Platform Super Admin:
 * مؤشرات عامة + توزيع الاشتراكات (رسم بياني) + أحدث الشركات.
 * البيانات تجريبية (mock) — موسومة بشريط واضح.
 */

import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Activity,
  Building2,
  CircleArrowRight,
  CreditCard,
  UsersRound,
} from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  useCompanies,
  usePlatformStats,
} from "@/features/platform/data/queries"
import {
  ConnectionBadge,
  PlanBadge,
  SubscriptionBadge,
} from "@/features/platform/components/status-badges"
import type { PlatformTenantOverview } from "@/types"

const chartConfig = {
  count: { label: "", color: "var(--chart-1)" },
} satisfies ChartConfig

export function PlatformDashboardPage() {
  const { t, i18n } = useTranslation()
  const { data: companies, isLoading } = useCompanies()
  const stats = usePlatformStats(companies)

  const locale = i18n.language?.startsWith("en") ? "en" : "ar"

  const statusData = Object.entries(stats.bySubscriptionStatus)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      status: t(`subscription.status.${status}`),
      count,
    }))

  const columns: Array<DataTableColumn<PlatformTenantOverview>> = [
    {
      id: "name",
      header: t("table.company"),
      searchText: (row) => `${row.name} ${row.slug}`,
      render: (row) => (
        <Link
          to={`/platform/companies/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "connection",
      header: t("table.connection"),
      render: (row) => <ConnectionBadge state={row.connection_state} />,
    },
    {
      id: "plan",
      header: t("table.plan"),
      render: (row) =>
        row.subscription ? <PlanBadge plan={row.subscription.plan} /> : "—",
    },
    {
      id: "subStatus",
      header: t("table.subscription"),
      render: (row) =>
        row.subscription ? (
          <SubscriptionBadge status={row.subscription.status} />
        ) : (
          "—"
        ),
    },
    {
      id: "users",
      header: t("table.users"),
      className: "font-latin text-label",
      render: (row) => row.usage?.active_users ?? 0,
    },
  ]

  const recent = [...(companies ?? [])]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.platform.dashboard")}
        description={t("platform.dashboard.description")}
        actions={
          <Button asChild variant="outline">
            <Link to="/platform/companies">
              {t("nav.platform.companies")}
              <CircleArrowRight className="rtl:rotate-180" />
            </Link>
          </Button>
        }
      />

      <DemoBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t("platform.stats.totalCompanies")}
          value={stats.total}
          icon={Building2}
          tone="arc"
          hint={`${stats.connected} ${t("platform.stats.connectedHint")}`}
        />
        <KpiCard
          title={t("platform.stats.activeSubscriptions")}
          value={stats.activeSubscriptions}
          icon={CreditCard}
          tone="ok"
        />
        <KpiCard
          title={t("platform.stats.totalUsers")}
          value={stats.totalUsers.toLocaleString("en-US")}
          icon={UsersRound}
          tone="copper"
        />
        <KpiCard
          title={t("platform.stats.totalEmployees")}
          value={stats.totalEmployees.toLocaleString("en-US")}
          icon={Activity}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t("platform.charts.subscriptionDistribution")}
            </CardTitle>
            <CardDescription>
              {t("platform.charts.subscriptionDistributionDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <BarChart data={statusData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="status"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={44}
                />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar
                  dataKey="count"
                  fill="var(--color-count)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={44}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              {t("platform.recentCompanies")}
            </CardTitle>
            <CardDescription>
              {t("platform.recentCompaniesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              rows={recent}
              isLoading={isLoading}
              pageSize={5}
              hideSearch
              emptyMessage={t("common.noData")}
            />
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-xs text-muted-foreground/60">
        {locale === "ar"
          ? "المنطقة دي خاصة بـ Platform Super Admin — عزل كامل عن منطقة الشركات."
          : "This area is for the Platform Super Admin — fully isolated from company workspaces."}
      </p>
    </div>
  )
}
