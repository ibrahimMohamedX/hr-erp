/**
 * قسم الإجازات — الوحدة الكاملة:
 * 5 مؤشرات (معلق/معتمد/مرفوض/ملغى/أيام قادمة) + جدول الطلبات
 * (بحث + فلترة بالنوع والحالة + ترتيب) + قرار المدير (اعتماد/رفض بسبب
 * إلزامي) + تعديل/إلغاء حسب الحالة والصلاحيات + الربط الآمن بالحضور
 * (سجلات on_leave للأيام الخالية فقط — لا تعديل أي سجل قائم)
 * + أنواع وأرصدة قابلة للتهيئة + تقارير لكل نوع مع تصدير CSV.
 *
 * كل الحسابات عبر محرك leave-rules النقي — لا حساب مكرر هنا.
 * في live: جداول غير مهيأة (قبل hr-leaves.sql) → تنبيه صادق،
 * لا بيانات وهمية إطلاقًا.
 */

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  Download,
  Hourglass,
  Pencil,
  PlaneTakeoff,
  Plus,
  Tags,
  TriangleAlert,
  Wallet,
  XCircle,
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
import { useCan } from "@/features/auth/hooks/use-can"
import {
  useApplyLeaveToAttendance,
  useCancelLeaveRequest,
  useEmployees,
  useLeaveRequests,
  useLeaveTypes,
} from "@/features/company/data/queries"
import { localToday } from "@/features/company/lib/attendance-rules"
import {
  leaveStatusCounts,
  upcomingApprovedDays,
} from "@/features/company/lib/leave-rules"
import { appEnv } from "@/config/env"
import { permission } from "@/lib/rbac/permissions"
import { cn } from "@/lib/utils"
import type { LeaveRequest, LeaveRequestStatus } from "@/types"

import { LeaveRequestForm, mapLeaveError } from "./leave-request-form"
import { LeaveDecisionDialog } from "./leave-decision-dialog"
import { LeaveTypesManager } from "./leave-types-manager"
import { LeaveBalancesDialog } from "./leave-balances-dialog"

// ─── أدوات محلية ─────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
] as const satisfies readonly LeaveRequestStatus[]

const statusStyles: Record<LeaveRequestStatus, string> = {
  pending: "border-warn/50 text-warn",
  approved: "border-ok/40 text-ok",
  rejected: "border-error/50 text-error",
  cancelled: "border-muted-foreground/40 text-muted-foreground",
}

function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  const { t } = useTranslation()
  return (
    <Badge variant="outline" className={cn("text-[11px]", statusStyles[status])}>
      {t(`leaves.status.${status}`)}
    </Badge>
  )
}

/** سطر ملخص النوع داخل التقارير */
interface TypeReportRow {
  leave_type_id: string
  leave_type_name: string
  requestsCount: number
  pendingCount: number
  approvedCount: number
  approvedDays: number
  rejectedCount: number
  cancelledCount: number
}

// ─── الصفحة ──────────────────────────────────────────────────────────────────

export function LeavesPage() {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"
  const isLive = appEnv.companyMode === "live"

  const { data: requests, isLoading } = useLeaveRequests()
  const { data: types } = useLeaveTypes()
  const { data: employees } = useEmployees()

  const canCreate = useCan(permission("module:leaves", "create")).allowed
  const canEdit = useCan(permission("module:leaves", "update")).allowed
  const canApprove = useCan(permission("module:leaves", "approve")).allowed

  // الحوارات — واحدة لكل غرض
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveRequest | null>(null)
  const [decision, setDecision] = useState<{
    request: LeaveRequest
    mode: "approve" | "reject"
  } | null>(null)
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null)
  const [syncing, setSyncing] = useState<LeaveRequest | null>(null)
  const [typesOpen, setTypesOpen] = useState(false)
  const [balancesOpen, setBalancesOpen] = useState(false)

  const today = localToday()

  const cancelLeave = useCancelLeaveRequest()
  const syncLeave = useApplyLeaveToAttendance()

  // ── المؤشرات: عدادات الحالة + أيام الإجازات القادمة المعتمدة ──
  const counts = useMemo(
    () => leaveStatusCounts(requests ?? []),
    [requests],
  )
  const upcomingDays = useMemo(
    () => upcomingApprovedDays(requests ?? [], today),
    [requests, today],
  )

  // ── أعمدة الجدول (متغيرات مسماة — تُستخدم في الفلاتر أيضًا) ──
  const employeeColumn: DataTableColumn<LeaveRequest> = {
    id: "employee",
    header: t("employee.name"),
    searchText: (row) => row.employee_name,
    sortValue: (row) => row.employee_name,
    render: (row) => <span className="font-medium">{row.employee_name}</span>,
  }

  const typeColumn: DataTableColumn<LeaveRequest> = {
    id: "type",
    header: t("leaves.typeLabel"),
    filterValue: (row) => row.leave_type_id,
    sortValue: (row) => row.leave_type_name,
    render: (row) => row.leave_type_name,
  }

  const datesColumn: DataTableColumn<LeaveRequest> = {
    id: "dates",
    header: t("leaves.dates"),
    className: "hidden font-latin text-label md:table-cell",
    sortValue: (row) => row.start_date,
    render: (row) => (
      <span dir="ltr">
        {row.start_date} → {row.end_date}
      </span>
    ),
  }

  const daysColumn: DataTableColumn<LeaveRequest> = {
    id: "days",
    header: t("leaves.workDays"),
    className: "font-latin text-label",
    sortValue: (row) => row.days,
    render: (row) => <span dir="ltr">{row.days}</span>,
  }

  const reasonColumn: DataTableColumn<LeaveRequest> = {
    id: "reason",
    header: t("leaves.reason"),
    className: "hidden max-w-48 truncate text-muted-foreground lg:table-cell",
    render: (row) => row.reason ?? "—",
  }

  const decidedColumn: DataTableColumn<LeaveRequest> = {
    id: "decided",
    header: t("leaves.decidedAt"),
    className: "hidden font-latin text-label lg:table-cell",
    sortValue: (row) => row.decided_at ?? "",
    render: (row) =>
      row.decided_at ? (
        <span dir="ltr" title={row.rejection_reason ?? undefined}>
          {row.decided_at.slice(0, 10)}
        </span>
      ) : (
        "—"
      ),
  }

  const statusColumn: DataTableColumn<LeaveRequest> = {
    id: "status",
    header: t("table.status"),
    filterValue: (row) => row.status,
    sortValue: (row) => row.status,
    render: (row) => <LeaveStatusBadge status={row.status} />,
  }

  const showActions = canApprove || canEdit
  const actionsColumn: DataTableColumn<LeaveRequest> = {
    id: "actions",
    header: t("common.actions"),
    className: "w-40",
    render: (row) => (
      <div className="flex items-center justify-end gap-1">
        {canApprove && row.status === "pending" ? (
          <>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("leaves.approveAction")}
              title={t("leaves.approveAction")}
              data-testid={`lv-approve-${row.id}`}
              onClick={() => setDecision({ request: row, mode: "approve" })}
            >
              <CheckCircle2 className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("leaves.rejectAction")}
              title={t("leaves.rejectAction")}
              data-testid={`lv-reject-${row.id}`}
              onClick={() => setDecision({ request: row, mode: "reject" })}
            >
              <XCircle className="size-4" />
            </Button>
          </>
        ) : null}
        {canEdit && row.status === "pending" ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("common.edit")}
            title={t("common.edit")}
            data-testid={`lv-edit-${row.id}`}
            onClick={() => setEditing(row)}
          >
            <Pencil className="size-4" />
          </Button>
        ) : null}
        {canEdit && (row.status === "pending" || row.status === "approved") ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("leaves.cancelAction")}
            title={t("leaves.cancelAction")}
            data-testid={`lv-cancel-${row.id}`}
            onClick={() => setCancelling(row)}
          >
            <Ban className="size-4" />
          </Button>
        ) : null}
        {canApprove && row.status === "approved" ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("leaves.sync.action")}
            title={t("leaves.sync.action")}
            data-testid={`lv-sync-${row.id}`}
            onClick={() => setSyncing(row)}
          >
            <PlaneTakeoff className="size-4" />
          </Button>
        ) : null}
      </div>
    ),
  }

  const columns: Array<DataTableColumn<LeaveRequest>> = [
    employeeColumn,
    typeColumn,
    datesColumn,
    daysColumn,
    reasonColumn,
    decidedColumn,
    statusColumn,
    ...(showActions ? [actionsColumn] : []),
  ]

  // ── الفلاتر: النوع والحالة معًا (AND) ──
  const filters: Array<DataTableFilter<LeaveRequest>> = [
    {
      column: typeColumn,
      options: (types ?? []).map((x) => ({
        value: x.id,
        label: x.name,
      })),
    },
    {
      column: statusColumn,
      options: ALL_STATUSES.map((s) => ({
        value: s,
        label: t(`leaves.status.${s}`),
      })),
    },
  ]

  // ── التقارير: ملخص لكل نوع (مرتب بالأيام المعتمدة تنازليًا) ──
  const reportRows = useMemo<TypeReportRow[]>(() => {
    const map = new Map<string, TypeReportRow>()
    const ensure = (typeId: string, typeName: string) => {
      const row = map.get(typeId) ?? {
        leave_type_id: typeId,
        leave_type_name: typeName,
        requestsCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        approvedDays: 0,
        rejectedCount: 0,
        cancelledCount: 0,
      }
      map.set(typeId, row)
      return row
    }
    for (const r of requests ?? []) {
      const row = ensure(r.leave_type_id, r.leave_type_name)
      row.requestsCount += 1
      if (r.status === "pending") row.pendingCount += 1
      if (r.status === "approved") {
        row.approvedCount += 1
        row.approvedDays += r.days
      }
      if (r.status === "rejected") row.rejectedCount += 1
      if (r.status === "cancelled") row.cancelledCount += 1
    }
    return [...map.values()].sort((a, b) => b.approvedDays - a.approvedDays)
  }, [requests])

  const reportColumns: Array<DataTableColumn<TypeReportRow>> = [
    {
      id: "type",
      header: t("leaves.typeLabel"),
      render: (row) => <span className="font-medium">{row.leave_type_name}</span>,
    },
    {
      id: "requestsCount",
      header: t("leaves.reports.requests"),
      className: "font-latin text-label",
      sortValue: (row) => row.requestsCount,
      render: (row) => <span dir="ltr">{row.requestsCount}</span>,
    },
    {
      id: "pendingCount",
      header: t("leaves.status.pending"),
      className: "font-latin text-label",
      sortValue: (row) => row.pendingCount,
      render: (row) => <span dir="ltr">{row.pendingCount}</span>,
    },
    {
      id: "approvedDays",
      header: t("leaves.reports.approvedDays"),
      className: "font-latin text-label",
      sortValue: (row) => row.approvedDays,
      render: (row) => <span dir="ltr">{row.approvedDays}</span>,
    },
    {
      id: "rejectedCount",
      header: t("leaves.status.rejected"),
      className: "font-latin text-label",
      sortValue: (row) => row.rejectedCount,
      render: (row) => <span dir="ltr">{row.rejectedCount}</span>,
    },
    {
      id: "cancelledCount",
      header: t("leaves.status.cancelled"),
      className: "font-latin text-label",
      sortValue: (row) => row.cancelledCount,
      render: (row) => <span dir="ltr">{row.cancelledCount}</span>,
    },
  ]

  // ── تصدير CSV (client-side) — بـ BOM ليفتح Excel العربية سليمة ──
  const exportCsv = () => {
    const csvEscape = (value: string) =>
      /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
    const headers = [
      t("leaves.typeLabel"),
      t("leaves.reports.requests"),
      t("leaves.status.pending"),
      t("leaves.reports.approvedDays"),
      t("leaves.status.rejected"),
      t("leaves.status.cancelled"),
    ]
    const lines = [
      headers,
      ...reportRows.map((row) => [
        row.leave_type_name,
        String(row.requestsCount),
        String(row.pendingCount),
        String(row.approvedDays),
        String(row.rejectedCount),
        String(row.cancelledCount),
      ]),
    ]
    const csv =
      "\uFEFF" + lines.map((l) => l.map(csvEscape).join(",")).join("\r\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "leaves-report.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  // ── شريط أدوات الجدول: طلب جديد + الأنواع + الأرصدة ──
  const toolbarActions = (
    <>
      {canCreate ? (
        <Button data-testid="lv-btn-new" onClick={() => setCreateOpen(true)}>
          <Plus />
          {t("leaves.newRequest")}
        </Button>
      ) : null}
      {canEdit ? (
        <Button
          variant="outline"
          data-testid="lv-btn-types"
          onClick={() => setTypesOpen(true)}
        >
          <Tags />
          {t("leaves.types.button")}
        </Button>
      ) : null}
      <Button
        variant="outline"
        data-testid="lv-btn-balances"
        onClick={() => setBalancesOpen(true)}
      >
        <Wallet />
        {t("leaves.balances.button")}
      </Button>
    </>
  )

  // تنبيه live الصادق: الجداول غير مهيأة — لا بيانات وهمية إطلاقًا
  // (الأنواع فارغة هي الإشارة الأقوى: البذرة دائمًا توفر 4 أنواع)
  const showSchemaHint =
    isLive &&
    !isLoading &&
    (types?.length ?? 0) === 0 &&
    (employees?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.leaves.name")}
        description={t("modules.leaves.description")}
      />

      {isDemo ? <DemoBanner /> : null}

      {showSchemaHint ? (
        <Alert data-testid="lv-schema-hint">
          <TriangleAlert className="size-4" />
          <AlertTitle>{t("leaves.schemaHintTitle")}</AlertTitle>
          <AlertDescription>{t("leaves.schemaHint")}</AlertDescription>
        </Alert>
      ) : null}

      {/* المؤشرات الخمسة */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div data-testid="lv-kpi-pending">
          <KpiCard
            title={t("leaves.status.pending")}
            value={counts.pending}
            icon={Hourglass}
            tone="warn"
          />
        </div>
        <div data-testid="lv-kpi-approved">
          <KpiCard
            title={t("leaves.status.approved")}
            value={counts.approved}
            icon={CheckCircle2}
            tone="ok"
          />
        </div>
        <div data-testid="lv-kpi-rejected">
          <KpiCard
            title={t("leaves.status.rejected")}
            value={counts.rejected}
            icon={XCircle}
            tone="error"
          />
        </div>
        <div data-testid="lv-kpi-cancelled">
          <KpiCard
            title={t("leaves.status.cancelled")}
            value={counts.cancelled}
            icon={Ban}
            tone="copper"
          />
        </div>
        <div data-testid="lv-kpi-upcoming">
          <KpiCard
            title={t("leaves.upcomingDays")}
            value={upcomingDays}
            icon={CalendarClock}
            tone="arc"
          />
        </div>
      </div>

      {/* جدول الطلبات */}
      <DataTable
        columns={columns}
        rows={requests ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("common.search")}
        filters={filters}
        toolbarActions={toolbarActions}
      />

      {/* التقارير والإحصائيات لكل نوع */}
      <div className="space-y-3" data-testid="lv-reports">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold">
              {t("leaves.reports.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("leaves.reports.description")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={exportCsv}
            disabled={reportRows.length === 0}
            data-testid="lv-export-csv"
          >
            <Download />
            {t("leaves.reports.exportCsv")}
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

      {/* تقديم طلب جديد */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("leaves.newRequestTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("leaves.newRequestDescription")}
            </DialogDescription>
          </DialogHeader>
          <LeaveRequestForm mode="create" onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* تعديل طلب معلق من الصف */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("leaves.editTitle")}
            </DialogTitle>
            <DialogDescription>{t("leaves.editDescription")}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <LeaveRequestForm
              key={editing.id}
              mode="edit"
              request={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* قرار المدير: اعتماد أو رفض بسبب */}
      <LeaveDecisionDialog
        request={decision?.request ?? null}
        mode={decision?.mode ?? "approve"}
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null)
        }}
      />

      {/* أنواع الإجازات والأرصدة القابلة للتهيئة */}
      <LeaveTypesManager open={typesOpen} onOpenChange={setTypesOpen} />

      {/* جدول الأرصدة لكل موظف × نوع */}
      <LeaveBalancesDialog open={balancesOpen} onOpenChange={setBalancesOpen} />

      {/* تأكيد الإلغاء */}
      <AlertDialog
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {t("leaves.cancelTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("leaves.cancelDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {cancelling ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
              {cancelling.employee_name} · {cancelling.leave_type_name} ·{" "}
              <span className="font-latin text-label" dir="ltr">
                {cancelling.start_date} → {cancelling.end_date}
              </span>
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLeave.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={cancelLeave.isPending}
              data-testid="lv-confirm-cancel"
              onClick={(event) => {
                if (!cancelling) return
                event.preventDefault()
                cancelLeave.mutate(cancelling.id, {
                  onSuccess: () => {
                    toast.success(t("leaves.cancelledToast"), {
                      description: `${cancelling.employee_name} · ${cancelling.leave_type_name}`,
                    })
                    setCancelling(null)
                  },
                  onError: (error) => toast.error(mapLeaveError(t, error)),
                })
              }}
            >
              {cancelLeave.isPending
                ? t("common.loading")
                : t("leaves.cancelAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* تأكيد الربط الآمن بالحضور */}
      <AlertDialog
        open={syncing !== null}
        onOpenChange={(open) => {
          if (!open) setSyncing(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {t("leaves.sync.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("leaves.sync.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {syncing ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
              {syncing.employee_name} · {syncing.leave_type_name} ·{" "}
              <span className="font-latin text-label" dir="ltr">
                {syncing.start_date} → {syncing.end_date} ({syncing.days})
              </span>
            </p>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncLeave.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={syncLeave.isPending}
              data-testid="lv-sync-confirm"
              onClick={(event) => {
                if (!syncing) return
                event.preventDefault()
                syncLeave.mutate(syncing.id, {
                  onSuccess: (created) => {
                    toast.success(
                      t("leaves.sync.toast", { n: created }),
                      {
                        description: `${syncing.employee_name} · ${t(
                          "leaves.sync.toastDescription",
                        )}`,
                      },
                    )
                    setSyncing(null)
                  },
                  onError: (error) => toast.error(mapLeaveError(t, error)),
                })
              }}
            >
              {syncLeave.isPending ? t("common.loading") : t("leaves.sync.action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
