/**
 * لوحة الشركة — مؤشرات حية من متجر البيانات التجريبي:
 * القوى العاملة، حضور اليوم، الإجازات المعلقة، تكلفة الرواتب
 * + رسم حضور آخر 7 أيام + توزيع الإدارات + اختصارات الأقسام المتاحة.
 */

import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
} from "recharts"
import {
  Banknote,
  CalendarClock,
  CircleArrowRight,
  Palmtree,
  UserSquare2,
} from "lucide-react"

import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { ModuleIcon } from "@/components/module-icon"
import { PageHeader } from "@/components/page-header"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAttendanceToday,
  useDepartments,
  useEmployees,
  useLeaveRequests,
} from "@/features/company/data/queries"
import { employeesByDepartment, payrollSummary, weeklyAttendance } from "@/features/company/data/mock-db"
import { HR_MODULES } from "@/config/modules"
import { canAccess } from "@/lib/rbac/evaluate"
import { permission } from "@/lib/rbac/permissions"
import { useSession } from "@/features/auth/session"
import type { Locale } from "@/types"

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const attendanceChartConfig = {
  present: { label: "", color: "var(--chart-3)" },
  late: { label: "", color: "var(--chart-4)" },
  absent: { label: "", color: "var(--chart-5)" },
} satisfies ChartConfig

export function CompanyDashboardPage() {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language?.startsWith("en") ? "en" : "ar") as Locale
  const { rbacContext } = useSession()

  const { data: employees, isLoading: employeesLoading } = useEmployees()
  const { data: departments } = useDepartments()
  const { data: attendance, isLoading: attendanceLoading } = useAttendanceToday()
  const { data: leaves, isLoading: leavesLoading } = useLeaveRequests()

  const activeEmployees =
    employees?.filter((emp) => emp.status !== "terminated") ?? []
  const presentToday =
    attendance?.filter(
      (a) => a.status === "present" || a.status === "late",
    ) ?? []
  const pendingLeaves = leaves?.filter((l) => l.status === "pending") ?? []

  const deptData = employeesByDepartment(activeEmployees, departments ?? [])

  const quickModules = HR_MODULES.filter(
    (m) =>
      rbacContext &&
      canAccess(rbacContext, permission(`module:${m.key}`, "view")),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.company.dashboard")}
        description={t("company.dashboard.description")}
      />

      <DemoBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t("company.stats.workforce")}
          value={employeesLoading ? "…" : activeEmployees.length}
          icon={UserSquare2}
          tone="arc"
          hint={`${activeEmployees.filter((e) => e.status === "probation").length} ${t("company.stats.probationHint")}`}
        />
        <KpiCard
          title={t("company.stats.presentToday")}
          value={attendanceLoading ? "…" : presentToday.length}
          icon={CalendarClock}
          tone="ok"
          hint={`${attendance?.filter((a) => a.status === "late").length ?? 0} ${t("company.stats.lateHint")}`}
        />
        <KpiCard
          title={t("company.stats.pendingLeaves")}
          value={leavesLoading ? "…" : pendingLeaves.length}
          icon={Palmtree}
          tone="copper"
        />
        <KpiCard
          title={t("company.stats.monthlyPayroll")}
          value={`${payrollSummary.total_net.toLocaleString("en-US")} EGP`}
          icon={Banknote}
          tone="neutral"
          hint={`${payrollSummary.total_employees} ${t("company.stats.employeesHint")}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              {t("company.charts.weeklyAttendance")}
            </CardTitle>
            <CardDescription>
              {t("company.charts.weeklyAttendanceDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={attendanceChartConfig}
              className="h-56 w-full"
            >
              <AreaChart data={weeklyAttendance}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                <Area
                  dataKey="present"
                  type="monotone"
                  fill="var(--color-present)"
                  fillOpacity={0.15}
                  stroke="var(--color-present)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="late"
                  type="monotone"
                  fill="var(--color-late)"
                  fillOpacity={0.15}
                  stroke="var(--color-late)"
                  strokeWidth={2}
                />
                <Area
                  dataKey="absent"
                  type="monotone"
                  fill="var(--color-absent)"
                  fillOpacity={0.12}
                  stroke="var(--color-absent)"
                  strokeWidth={2}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t("company.charts.departmentsDistribution")}
            </CardTitle>
            <CardDescription>
              {t("company.charts.departmentsDistributionDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ count: { label: "", color: "var(--chart-1)" } }}
              className="mx-auto h-56 w-full"
            >
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={deptData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={80}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {deptData.map((entry, index) => (
                    <Cell
                      key={entry.code}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {deptData.map((d, i) => (
                <span key={d.code} className="flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  {d.name} · {d.count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("company.quickAccess")}
          </CardTitle>
          <CardDescription>
            {t("company.quickAccessDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quickModules.length === 0 ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {quickModules.map((module) => (
                <Link
                  key={module.key}
                  to={module.route}
                  className="group flex flex-col items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-arc/40 hover:bg-accent/40"
                >
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ModuleIcon name={module.icon} className="size-5" />
                  </span>
                  <span className="text-sm font-medium">
                    {module.name[locale]}
                  </span>
                  <CircleArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
