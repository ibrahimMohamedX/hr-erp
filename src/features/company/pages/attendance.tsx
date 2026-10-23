/**
 * قسم الحضور والانصراف — الوحدة الكاملة:
 * نطاق زمني (اليوم/آخر 7/هذا الشهر/الكل/مخصص) + 5 مؤشرات + جدول السجلات
 * (بحث + فلترة بالإدارة والحالة + ترتيب) + تسجيل حضور/انصراف سريع
 * + إضافة/تعديل/حذف يدوي حسب الصلاحيات + تقارير لكل موظف مع تصدير CSV
 * + حوارية قواعد الدوام القابلة للتهيئة.
 *
 * كل الحسابات عبر محرك attendance-rules النقي — لا حساب مكرر هنا.
 * في live: جداول غير مهيأة بعد (قبل hr-attendance.sql) → تنبيه صادق،
 * لا بيانات وهمية إطلاقًا.
 */

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  CalendarClock,
  CalendarX2,
  Clock,
  Download,
  Hourglass,
  LogIn,
  LogOut,
  Pencil,
  PlaneTakeoff,
  Plus,
  Settings2,
  TriangleAlert,
  Trash2,
} from "lucide-react"

import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { KpiCard } from "@/components/kpi-card"
import { PageHeader } from "@/components/page-header"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCan } from "@/features/auth/hooks/use-can"
import {
  useAttendance,
  useAttendanceSettings,
  useCheckIn,
  useCheckOut,
  useDeleteAttendance,
  useDepartments,
  useEmployees,
} from "@/features/company/data/queries"
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  computeLateMinutes,
  computeWorkedMinutes,
  localToday,
} from "@/features/company/lib/attendance-rules"
import { appEnv } from "@/config/env"
import { permission } from "@/lib/rbac/permissions"
import { cn } from "@/lib/utils"
import type { AttendanceRecord, AttendanceStatus, UUID } from "@/types"

import { AttendanceCheckDialog } from "./attendance-check-dialog"
import { AttendanceRecordForm, mapAttendanceError } from "./attendance-record-form"
import { AttendanceSettingsForm } from "./attendance-settings-form"

// ─── أدوات محلية صغيرة ─────────────────────────────────────────────────────

const ALL_STATUSES = [
  "present",
  "late",
  "absent",
  "on_leave",
] as const satisfies readonly AttendanceStatus[]

type RangeValue = "today" | "last7" | "month" | "all" | "custom"

/** تاريخ محلي قبل n يومًا — عبر مكونات التاريخ (آمن مع تغيير الساعة) */
function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

/** دقائق → نص ساعات بعشرية واحدة: 426 → "7.1" */
function minutesToHoursText(minutes: number): string {
  return (minutes / 60).toFixed(1)
}

/** سطر ملخص الموظف داخل التقارير */
interface EmployeeReportRow {
  employee_id: UUID
  employee_name: string
  department: string
  daysRecorded: number
  totalWorkedMinutes: number
  completedDays: number
  lateDays: number
  absentDays: number
  leaveDays: number
}

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

// ─── الصفحة ──────────────────────────────────────────────────────────────────

export function AttendancePage() {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"
  const isLive = appEnv.companyMode === "live"

  const { data: records, isLoading } = useAttendance()
  const { data: employees } = useEmployees()
  const { data: departments } = useDepartments()
  const { data: settings } = useAttendanceSettings()

  const canCreate = useCan(permission("module:attendance", "create")).allowed
  const canEdit = useCan(permission("module:attendance", "update")).allowed
  const canDelete = useCan(permission("module:attendance", "delete")).allowed

  // الحوارات — واحدة لكل غرض
  const [range, setRange] = useState<RangeValue>("today")
  const [rangeFrom, setRangeFrom] = useState("")
  const [rangeTo, setRangeTo] = useState("")
  const [checkDialog, setCheckDialog] = useState<{
    open: boolean
    mode: "in" | "out"
  }>({ open: false, mode: "in" })
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<AttendanceRecord | null>(null)
  const [deleting, setDeleting] = useState<AttendanceRecord | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const today = localToday()
  const effSettings = settings ?? DEFAULT_ATTENDANCE_SETTINGS

  const checkIn = useCheckIn()
  const checkOut = useCheckOut()
  const deleteAttendance = useDeleteAttendance()

  // ── النطاق الزمني: يغذي الجدول والمؤشرات والتقارير معًا ──
  const rangeRecords = useMemo(() => {
    const all = records ?? []
    switch (range) {
      case "today":
        return all.filter((r) => r.date === today)
      case "last7":
        return all.filter(
          (r) => r.date <= today && r.date >= daysAgoISO(6),
        )
      case "month":
        return all.filter(
          (r) => r.date <= today && r.date >= `${today.slice(0, 7)}-01`,
        )
      case "all":
        return all
      case "custom":
        if (!rangeFrom && !rangeTo) return all
        return all.filter(
          (r) =>
            (!rangeFrom || r.date >= rangeFrom) &&
            (!rangeTo || r.date <= rangeTo),
        )
    }
  }, [records, range, rangeFrom, rangeTo, today])

  // ── المؤشرات: عدّ الحالات + متوسط ساعات العمل داخل النطاق ──
  const countByStatus = (status: AttendanceStatus) =>
    rangeRecords.filter((r) => r.status === status).length

  const avgWorkedText = useMemo(() => {
    const complete = rangeRecords.filter((r) => r.check_in && r.check_out)
    if (complete.length === 0) return "—"
    const total = complete.reduce(
      (sum, r) =>
        sum + computeWorkedMinutes(r.check_in!, r.check_out!),
      0,
    )
    return minutesToHoursText(total / complete.length)
  }, [rangeRecords])

  const depName = useMemo(() => {
    const map = new Map<string, string>()
    departments?.forEach((d) => map.set(d.id, d.name))
    return map
  }, [departments])

  // ── أزرار سريعة داخل الصف (حضور/انصراف اليوم) ──
  const quickCheckIn = (record: AttendanceRecord) => {
    checkIn.mutate(record.employee_id, {
      onSuccess: (updated) => {
        toast.success(t("attendance.checkedInToast"), {
          description: `${record.employee_name} · ${updated.check_in ?? ""}${
            isDemo ? ` — ${t("demo.toastSuffix")}` : ""
          }`,
        })
      },
      onError: (error) => toast.error(mapAttendanceError(t, error)),
    })
  }

  const quickCheckOut = (record: AttendanceRecord) => {
    checkOut.mutate(record.employee_id, {
      onSuccess: (updated) => {
        toast.success(t("attendance.checkedOutToast"), {
          description: `${record.employee_name} · ${updated.check_out ?? ""}${
            isDemo ? ` — ${t("demo.toastSuffix")}` : ""
          }`,
        })
      },
      onError: (error) => toast.error(mapAttendanceError(t, error)),
    })
  }

  // ── أعمدة الجدول (متغيرات مسماة — تُستخدم في الفلاتر أيضًا) ──
  const employeeColumn: DataTableColumn<AttendanceRecord> = {
    id: "employee",
    header: t("employee.name"),
    searchText: (row) => row.employee_name,
    sortValue: (row) => row.employee_name,
    render: (row) => (
      <span className="font-medium" title={row.note ?? undefined}>
        {row.employee_name}
      </span>
    ),
  }

  const departmentColumn: DataTableColumn<AttendanceRecord> = {
    id: "department",
    header: t("employee.department"),
    filterValue: (row) => row.department_id,
    sortValue: (row) => depName.get(row.department_id) ?? "",
    render: (row) => depName.get(row.department_id) ?? "—",
  }

  const dateColumn: DataTableColumn<AttendanceRecord> = {
    id: "date",
    header: t("attendance.recordDate"),
    className: "font-latin text-label",
    sortValue: (row) => row.date,
    render: (row) => <span dir="ltr">{row.date}</span>,
  }

  const checkInColumn: DataTableColumn<AttendanceRecord> = {
    id: "checkIn",
    header: t("attendance.checkIn"),
    className: "font-latin text-label",
    sortValue: (row) => row.check_in ?? "",
    render: (row) => (row.check_in ? <span dir="ltr">{row.check_in}</span> : "—"),
  }

  const checkOutColumn: DataTableColumn<AttendanceRecord> = {
    id: "checkOut",
    header: t("attendance.checkOut"),
    className: "hidden font-latin text-label sm:table-cell",
    sortValue: (row) => row.check_out ?? "",
    render: (row) => (row.check_out ? <span dir="ltr">{row.check_out}</span> : "—"),
  }

  const workedColumn: DataTableColumn<AttendanceRecord> = {
    id: "worked",
    header: t("attendance.workedHours"),
    className: "font-latin text-label",
    sortValue: (row) =>
      row.check_in && row.check_out
        ? computeWorkedMinutes(row.check_in, row.check_out)
        : 0,
    render: (row) =>
      row.check_in && row.check_out ? (
        <span dir="ltr">
          {minutesToHoursText(
            computeWorkedMinutes(row.check_in, row.check_out),
          )}{" "}
          {t("attendance.hoursSuffix")}
        </span>
      ) : (
        "—"
      ),
  }

  const lateColumn: DataTableColumn<AttendanceRecord> = {
    id: "late",
    header: t("attendance.lateMinutes"),
    className: "hidden font-latin text-label lg:table-cell",
    sortValue: (row) =>
      row.check_in ? computeLateMinutes(row.check_in, effSettings) : 0,
    render: (row) => {
      if (!row.check_in) return "—"
      const late = computeLateMinutes(row.check_in, effSettings)
      if (late === 0) return "—"
      return (
        <span dir="ltr">
          {late} {t("attendance.minutesSuffix")}
        </span>
      )
    },
  }

  const statusColumn: DataTableColumn<AttendanceRecord> = {
    id: "status",
    header: t("table.status"),
    filterValue: (row) => row.status,
    sortValue: (row) => row.status,
    render: (row) => <AttendanceStatusBadge status={row.status} />,
  }

  const showActions = canCreate || canEdit || canDelete
  const actionsColumn: DataTableColumn<AttendanceRecord> = {
    id: "actions",
    header: t("common.actions"),
    className: "w-32",
    render: (row) => {
      const isToday = row.date === today
      return (
        <div className="flex items-center justify-end gap-1">
          {canCreate && isToday && !row.check_in ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("attendance.registerIn")}
              title={t("attendance.registerIn")}
              data-testid={`att-quick-in-${row.id}`}
              disabled={checkIn.isPending}
              onClick={() => quickCheckIn(row)}
            >
              <LogIn className="size-4" />
            </Button>
          ) : null}
          {canCreate && isToday && row.check_in && !row.check_out ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("attendance.registerOut")}
              title={t("attendance.registerOut")}
              data-testid={`att-quick-out-${row.id}`}
              disabled={checkOut.isPending}
              onClick={() => quickCheckOut(row)}
            >
              <LogOut className="size-4" />
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("common.edit")}
              title={t("common.edit")}
              data-testid={`att-edit-${row.id}`}
              onClick={() => setEditing(row)}
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("common.delete")}
              title={t("common.delete")}
              data-testid={`att-delete-${row.id}`}
              onClick={() => setDeleting(row)}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      )
    },
  }

  const columns: Array<DataTableColumn<AttendanceRecord>> = [
    employeeColumn,
    departmentColumn,
    dateColumn,
    checkInColumn,
    checkOutColumn,
    workedColumn,
    lateColumn,
    statusColumn,
    ...(showActions ? [actionsColumn] : []),
  ]

  // ── الفلاتر: الإدارة والحالة معًا (AND) ──
  const filters: Array<DataTableFilter<AttendanceRecord>> = [
    {
      column: departmentColumn,
      options: (departments ?? []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    },
    {
      column: statusColumn,
      options: ALL_STATUSES.map((s) => ({
        value: s,
        label: t(`attendance.status.${s}`),
      })),
    },
  ]

  // ── التقارير: ملخص لكل موظف داخل النطاق (مرتب بساعات العمل تنازليًا) ──
  const reportRows = useMemo<EmployeeReportRow[]>(() => {
    const map = new Map<UUID, EmployeeReportRow>()
    for (const r of rangeRecords) {
      const row = map.get(r.employee_id) ?? {
        employee_id: r.employee_id,
        employee_name: r.employee_name,
        department: depName.get(r.department_id) ?? "—",
        daysRecorded: 0,
        totalWorkedMinutes: 0,
        completedDays: 0,
        lateDays: 0,
        absentDays: 0,
        leaveDays: 0,
      }
      row.daysRecorded += 1
      if (r.check_in && r.check_out) {
        row.totalWorkedMinutes += computeWorkedMinutes(r.check_in, r.check_out)
        row.completedDays += 1
      }
      if (r.status === "late") row.lateDays += 1
      if (r.status === "absent") row.absentDays += 1
      if (r.status === "on_leave") row.leaveDays += 1
      map.set(r.employee_id, row)
    }
    return [...map.values()].sort(
      (a, b) => b.totalWorkedMinutes - a.totalWorkedMinutes,
    )
  }, [rangeRecords, depName])

  const reportColumns: Array<DataTableColumn<EmployeeReportRow>> = [
    {
      id: "employee",
      header: t("attendance.reports.employee"),
      render: (row) => <span className="font-medium">{row.employee_name}</span>,
    },
    {
      id: "department",
      header: t("attendance.reports.department"),
      render: (row) => row.department,
    },
    {
      id: "daysRecorded",
      header: t("attendance.reports.daysRecorded"),
      className: "font-latin text-label",
      sortValue: (row) => row.daysRecorded,
      render: (row) => <span dir="ltr">{row.daysRecorded}</span>,
    },
    {
      id: "totalWorked",
      header: t("attendance.reports.totalWorked"),
      className: "font-latin text-label",
      sortValue: (row) => row.totalWorkedMinutes,
      render: (row) => (
        <span dir="ltr">
          {minutesToHoursText(row.totalWorkedMinutes)}{" "}
          {t("attendance.hoursSuffix")}
        </span>
      ),
    },
    {
      id: "avgHours",
      header: t("attendance.reports.avgHours"),
      className: "font-latin text-label",
      sortValue: (row) =>
        row.completedDays > 0
          ? row.totalWorkedMinutes / row.completedDays
          : 0,
      render: (row) =>
        row.completedDays > 0 ? (
          <span dir="ltr">
            {minutesToHoursText(row.totalWorkedMinutes / row.completedDays)}{" "}
            {t("attendance.hoursSuffix")}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "lateDays",
      header: t("attendance.reports.lateDays"),
      className: "font-latin text-label",
      sortValue: (row) => row.lateDays,
      render: (row) => <span dir="ltr">{row.lateDays}</span>,
    },
    {
      id: "absentDays",
      header: t("attendance.reports.absentDays"),
      className: "font-latin text-label",
      sortValue: (row) => row.absentDays,
      render: (row) => <span dir="ltr">{row.absentDays}</span>,
    },
    {
      id: "leaveDays",
      header: t("attendance.reports.leaveDays"),
      className: "font-latin text-label",
      sortValue: (row) => row.leaveDays,
      render: (row) => <span dir="ltr">{row.leaveDays}</span>,
    },
  ]

  // ── تصدير CSV (client-side) — بـ BOM ليفتح Excel العربية سليمة ──
  const exportCsv = () => {
    const csvEscape = (value: string) =>
      /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
    const headers = [
      t("attendance.reports.employee"),
      t("attendance.reports.department"),
      t("attendance.reports.daysRecorded"),
      t("attendance.reports.totalWorked"),
      t("attendance.reports.avgHours"),
      t("attendance.reports.lateDays"),
      t("attendance.reports.absentDays"),
      t("attendance.reports.leaveDays"),
    ]
    const lines = [
      headers,
      ...reportRows.map((row) => [
        row.employee_name,
        row.department,
        String(row.daysRecorded),
        minutesToHoursText(row.totalWorkedMinutes),
        row.completedDays > 0
          ? minutesToHoursText(row.totalWorkedMinutes / row.completedDays)
          : "—",
        String(row.lateDays),
        String(row.absentDays),
        String(row.leaveDays),
      ]),
    ]
    const csv =
      "\uFEFF" + lines.map((l) => l.map(csvEscape).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "attendance-report.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  // ── شريط أدوات الجدول: تسجيل حضور/انصراف + سجل جديد + القواعد ──
  const toolbarActions = (
    <>
      {canCreate ? (
        <>
          <Button
            variant="outline"
            data-testid="att-btn-checkin"
            onClick={() => setCheckDialog({ open: true, mode: "in" })}
          >
            <LogIn />
            {t("attendance.registerIn")}
          </Button>
          <Button
            variant="outline"
            data-testid="att-btn-checkout"
            onClick={() => setCheckDialog({ open: true, mode: "out" })}
          >
            <LogOut />
            {t("attendance.registerOut")}
          </Button>
          <Button data-testid="att-btn-add" onClick={() => setCreateOpen(true)}>
            <Plus />
            {t("attendance.addRecord")}
          </Button>
        </>
      ) : null}
      {canEdit ? (
        <Button
          variant="outline"
          data-testid="att-btn-settings"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 />
          {t("attendance.settings.title")}
        </Button>
      ) : null}
    </>
  )

  const rangeOptions: Array<{ value: RangeValue; label: string }> = [
    { value: "today", label: t("attendance.range.today") },
    { value: "last7", label: t("attendance.range.last7") },
    { value: "month", label: t("attendance.range.month") },
    { value: "all", label: t("attendance.range.all") },
    { value: "custom", label: t("attendance.range.custom") },
  ]

  // تنبيه live الصادق: الجداول غير مهيأة — لا بيانات وهمية إطلاقًا
  const showSchemaHint =
    isLive &&
    !isLoading &&
    (records?.length ?? 0) === 0 &&
    (employees?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.attendance.name")}
        description={t("modules.attendance.description")}
      />

      {isDemo ? <DemoBanner /> : null}

      {showSchemaHint ? (
        <Alert data-testid="att-schema-hint">
          <TriangleAlert className="size-4" />
          <AlertTitle>{t("attendance.settings.title")}</AlertTitle>
          <AlertDescription>{t("attendance.schemaHint")}</AlertDescription>
        </Alert>
      ) : null}

      {/* شريط النطاق الزمني — يغذي المؤشرات والجدول والتقارير معًا */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label>{t("attendance.range.label")}</Label>
          <Select
            value={range}
            onValueChange={(v) => setRange(v as RangeValue)}
          >
            <SelectTrigger className="w-40" data-testid="att-range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rangeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {range === "custom" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="att-range-from">
                {t("attendance.range.from")}
              </Label>
              <Input
                id="att-range-from"
                type="date"
                dir="ltr"
                className="w-40"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
                data-testid="att-range-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="att-range-to">{t("attendance.range.to")}</Label>
              <Input
                id="att-range-to"
                type="date"
                dir="ltr"
                className="w-40"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
                data-testid="att-range-to"
              />
            </div>
          </>
        ) : null}
      </div>

      {/* المؤشرات الخمسة داخل النطاق المحدد */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div data-testid="att-kpi-present">
          <KpiCard
            title={t("attendance.status.present")}
            value={countByStatus("present")}
            icon={CalendarClock}
            tone="ok"
          />
        </div>
        <div data-testid="att-kpi-late">
          <KpiCard
            title={t("attendance.status.late")}
            value={countByStatus("late")}
            icon={Hourglass}
            tone="warn"
          />
        </div>
        <div data-testid="att-kpi-absent">
          <KpiCard
            title={t("attendance.status.absent")}
            value={countByStatus("absent")}
            icon={CalendarX2}
            tone="error"
          />
        </div>
        <div data-testid="att-kpi-leave">
          <KpiCard
            title={t("attendance.status.on_leave")}
            value={countByStatus("on_leave")}
            icon={PlaneTakeoff}
            tone="arc"
          />
        </div>
        <div data-testid="att-kpi-avg">
          <KpiCard
            title={t("attendance.stats.avgWorked")}
            value={avgWorkedText}
            icon={Clock}
            tone="copper"
          />
        </div>
      </div>

      {/* جدول السجلات */}
      <DataTable
        columns={columns}
        rows={rangeRecords}
        isLoading={isLoading}
        searchPlaceholder={t("common.search")}
        filters={filters}
        toolbarActions={toolbarActions}
      />

      {/* التقارير والإحصائيات لكل موظف داخل النطاق */}
      <div className="space-y-3" data-testid="att-reports">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {t("attendance.reports.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("attendance.reports.description")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={reportRows.length === 0}
            data-testid="att-export-csv"
          >
            <Download />
            {t("attendance.reports.exportCsv")}
          </Button>
        </div>
        <DataTable
          columns={reportColumns}
          rows={reportRows}
          hideSearch
          pageSize={8}
          emptyMessage={t("common.noData")}
        />
      </div>

      {/* حوارية التسجيل السريع (حضور/انصراف) */}
      <AttendanceCheckDialog
        mode={checkDialog.mode}
        open={checkDialog.open}
        onOpenChange={(open) => setCheckDialog((prev) => ({ ...prev, open }))}
      />

      {/* إضافة سجل يدوي */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("attendance.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("attendance.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <AttendanceRecordForm mode="create" onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* تعديل سجل من الصف */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("attendance.editTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("attendance.editDescription")}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <AttendanceRecordForm
              key={editing.id}
              mode="edit"
              record={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* قواعد الدوام القابلة للتهيئة */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("attendance.settings.title")}
            </DialogTitle>
            <DialogDescription>
              {t("attendance.settings.description")}
            </DialogDescription>
          </DialogHeader>
          <AttendanceSettingsForm onDone={() => setSettingsOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* حوارية تأكيد الحذف */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {t("attendance.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("attendance.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleting ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
              {deleting.employee_name} ·{" "}
              <span className="font-latin text-label" dir="ltr">
                {deleting.date}
              </span>
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteAttendance.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteAttendance.isPending}
              data-testid="att-confirm-delete"
              onClick={(event) => {
                if (!deleting) return
                event.preventDefault()
                deleteAttendance.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.success(t("attendance.deletedToast"), {
                      description: `${deleting.employee_name} · ${deleting.date}`,
                    })
                    setDeleting(null)
                  },
                  onError: (error) =>
                    toast.error(mapAttendanceError(t, error)),
                })
              }}
            >
              {deleteAttendance.isPending
                ? t("common.loading")
                : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
