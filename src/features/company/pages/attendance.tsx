/**
 * قسم الحضور والانصراف — سجل اليوم: ملخص الحالات + جدول بالوقت والحالة.
 * تسجيل الحضور الفعلي (أجهزة/تحقق جغرافي) مراحل لاحقة.
 */

import { useTranslation } from "react-i18next"
import { CalendarClock, CalendarX2, Hourglass, PlaneTakeoff } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import {
  useAttendanceToday,
  useDepartments,
} from "@/features/company/data/queries"
import { cn } from "@/lib/utils"
import type { AttendanceRecord, AttendanceStatus } from "@/types"

const statusStyles: Record<AttendanceStatus, string> = {
  present: "border-ok/40 text-ok",
  late: "border-warn/50 text-warn",
  absent: "border-error/50 text-error",
  on_leave: "border-arc/40 text-arc",
}

function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className={cn("text-[11px]", statusStyles[status])}>
      {t(`attendance.status.${status}`)}
    </Badge>
  )
}

export function AttendancePage() {
  const { t } = useTranslation()
  const { data: records, isLoading } = useAttendanceToday()
  const { data: departments } = useDepartments()

  const count = (status: AttendanceStatus) =>
    records?.filter((r) => r.status === status).length ?? 0

  const columns: Array<DataTableColumn<AttendanceRecord>> = [
    {
      id: "employee",
      header: t("employee.name"),
      searchText: (row) => row.employee_name,
      render: (row) => (
        <span className="font-medium">{row.employee_name}</span>
      ),
    },
    {
      id: "department",
      header: t("employee.department"),
      filterValue: (row) => row.department_id,
      render: (row) =>
        departments?.find((d) => d.id === row.department_id)?.name ?? "—",
    },
    {
      id: "checkIn",
      header: t("attendance.checkIn"),
      className: "font-latin text-label",
      render: (row) => row.check_in ?? "—",
    },
    {
      id: "checkOut",
      header: t("attendance.checkOut"),
      className: "hidden font-latin text-label sm:table-cell",
      render: (row) => row.check_out ?? "—",
    },
    {
      id: "status",
      header: t("table.status"),
      filterValue: (row) => row.status,
      render: (row) => <AttendanceStatusBadge status={row.status} />,
    },
  ]

  const filterOptions = (
    ["present", "late", "absent", "on_leave"] as AttendanceStatus[]
  ).map((status) => ({
    value: status,
    label: t(`attendance.status.${status}`),
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.attendance.name")}
        description={t("modules.attendance.description")}
      />

      <DemoBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t("attendance.status.present")}
          value={count("present")}
          icon={CalendarClock}
          tone="ok"
        />
        <KpiCard
          title={t("attendance.status.late")}
          value={count("late")}
          icon={Hourglass}
          tone="warn"
        />
        <KpiCard
          title={t("attendance.status.absent")}
          value={count("absent")}
          icon={CalendarX2}
          tone="error"
        />
        <KpiCard
          title={t("attendance.status.on_leave")}
          value={count("on_leave")}
          icon={PlaneTakeoff}
          tone="arc"
        />
      </div>

      <DataTable
        columns={columns}
        rows={records ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("common.search")}
        filter={{ column: columns[4], options: filterOptions }}
      />
    </div>
  )
}
