/**
 * الاشتراكات — متابعة اشتراك العميل (منتجنا) مع أزرار تحكم فعلية:
 * تفعيل (مرهون باتصال مُتحقق) · تعليق (لا يمس البنية) · تجديد 12 شهرًا.
 * كل الأزرار تعمل عبر Platform API (live عبر Edge Function / demo محاكاة).
 */

import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import {
  CalendarClock,
  CreditCard,
  MoreHorizontal,
  PlayCircle,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useCompanies,
  usePlatformStats,
  useSubscriptionUpdate,
} from "@/features/platform/data/queries"
import { PlanBadge, SubscriptionBadge } from "@/features/platform/components/status-badges"
import type { PlatformTenantOverview } from "@/types"

export function PlatformSubscriptionsPage() {
  const { t } = useTranslation()
  const { data: companies, isLoading } = useCompanies()
  const stats = usePlatformStats(companies)
  const subscriptionUpdate = useSubscriptionUpdate()

  const apply = (
    row: PlatformTenantOverview,
    update: "activate" | "suspend" | "renew",
  ) => {
    subscriptionUpdate.mutate({
      company_id: row.id,
      action: update,
      duration_months: 12,
    })
  }

  const columns: Array<DataTableColumn<PlatformTenantOverview>> = [
    {
      id: "company",
      header: t("table.company"),
      searchText: (row) => row.name,
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
      id: "plan",
      header: t("table.plan"),
      render: (row) =>
        row.subscription ? <PlanBadge plan={row.subscription.plan} /> : "—",
    },
    {
      id: "status",
      header: t("table.status"),
      filterValue: (row) => row.subscription?.status ?? "none",
      render: (row) =>
        row.subscription ? (
          <SubscriptionBadge status={row.subscription.status} />
        ) : (
          "—"
        ),
    },
    {
      id: "seats",
      header: t("subscription.seats"),
      className: "hidden font-latin text-label md:table-cell",
      render: (row) => {
        const used = row.usage?.active_users ?? 0
        const seats = row.subscription?.seats
        return seats ? `${used}/${seats}` : `${used}/∞`
      },
    },
    {
      id: "periodEnd",
      header: t("subscription.periodEnd"),
      className: "hidden font-latin text-label lg:table-cell",
      render: (row) => row.subscription?.current_period_end ?? "—",
    },
    {
      id: "actions",
      header: t("common.actions"),
      className: "w-12",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("common.actions")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              onClick={() => apply(row, "activate")}
              disabled={row.connection_state !== "connected"}
            >
              <PlayCircle />
              {t("subscription.action.activate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => apply(row, "renew")}
              disabled={subscriptionUpdate.isPending}
            >
              <RotateCcw />
              {t("subscription.action.renew")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => apply(row, "suspend")}
              disabled={subscriptionUpdate.isPending}
            >
              <ShieldAlert />
              {t("subscription.action.suspend")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const filterOptions = [
    ...new Set(
      (companies ?? [])
        .map((c) => c.subscription?.status)
        .filter((s): s is NonNullable<typeof s> => Boolean(s)),
    ),
  ].map((status) => ({
    value: status,
    label: t(`subscription.status.${status}`),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.platform.subscriptions")}
        description={t("platform.subscriptions.description")}
      />

      <DemoBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t("subscription.status.active")}
          value={stats.bySubscriptionStatus.active}
          icon={CreditCard}
          tone="ok"
        />
        <KpiCard
          title={t("subscription.status.trialing")}
          value={stats.bySubscriptionStatus.trialing}
          icon={Sparkles}
          tone="arc"
        />
        <KpiCard
          title={t("subscription.status.past_due")}
          value={stats.bySubscriptionStatus.past_due}
          icon={ShieldAlert}
          tone="warn"
        />
        <KpiCard
          title={t("subscription.status.suspended")}
          value={
            stats.bySubscriptionStatus.suspended +
            stats.bySubscriptionStatus.cancelled
          }
          icon={CalendarClock}
          tone="error"
        />
      </div>

      <DataTable
        columns={columns}
        rows={companies ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("common.search")}
        filters={[{ column: columns[2], options: filterOptions }]}
      />
    </div>
  )
}
