/**
 * LeaveBalancesDialog — جدول الأرصدة لكل موظف × نوع إجازة نشط
 * في السنة الحالية: الاستحقاق (أو ∞) · المستهلك المعتمد · المتبقي.
 *
 * الحساب كله عبر محرك leave-rules النقي (computeLeaveBalances) —
 * لا حساب مكرر هنا. النوع غير المحدود (annual_days = null) يظهر ∞.
 */

import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  DataTable,
  type DataTableColumn,
} from "@/components/data-table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  useEmployees,
  useLeaveRequests,
  useLeaveTypes,
} from "@/features/company/data/queries"
import { localToday } from "@/features/company/lib/attendance-rules"
import { computeLeaveBalances } from "@/features/company/lib/leave-rules"
import type { LeaveBalanceEntry } from "@/features/company/lib/leave-rules"

export interface LeaveBalancesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeaveBalancesDialog({
  open,
  onOpenChange,
}: LeaveBalancesDialogProps) {
  const { t } = useTranslation()
  const { data: employees } = useEmployees()
  const { data: types } = useLeaveTypes()
  const { data: requests } = useLeaveRequests()

  // الموظفون النشطون/تحت التجربة × الأنواع النشطة — السنة الحالية
  const balances = useMemo(() => {
    const active = (employees ?? []).filter(
      (e) => e.status === "active" || e.status === "probation",
    )
    const activeTypes = (types ?? []).filter((x) => x.is_active)
    const year = Number(localToday().slice(0, 4))
    return computeLeaveBalances(active, activeTypes, requests ?? [], year)
  }, [employees, types, requests])

  const columns: Array<DataTableColumn<LeaveBalanceEntry>> = [
    {
      id: "employee",
      header: t("employee.name"),
      searchText: (row) => row.employee_name,
      sortValue: (row) => row.employee_name,
      render: (row) => <span className="font-medium">{row.employee_name}</span>,
    },
    {
      id: "type",
      header: t("leaves.typeLabel"),
      searchText: (row) => row.leave_type_name,
      sortValue: (row) => row.leave_type_name,
      render: (row) => row.leave_type_name,
    },
    {
      id: "entitled",
      header: t("leaves.balances.entitled"),
      className: "font-latin text-label",
      sortValue: (row) => row.entitled ?? Number.MAX_SAFE_INTEGER,
      render: (row) => (
        <span dir="ltr">{row.entitled === null ? "∞" : row.entitled}</span>
      ),
    },
    {
      id: "used",
      header: t("leaves.balances.used"),
      className: "font-latin text-label",
      sortValue: (row) => row.used,
      render: (row) => <span dir="ltr">{row.used}</span>,
    },
    {
      id: "remaining",
      header: t("leaves.balances.remaining"),
      className: "font-latin text-label",
      sortValue: (row) => row.remaining ?? Number.MAX_SAFE_INTEGER,
      render: (row) => (
        <span
          dir="ltr"
          className={
            row.remaining !== null && row.remaining < 0 ? "text-error" : undefined
          }
          data-testid={`lv-balance-${row.employee_id}-${row.leave_type_id}`}
        >
          {row.remaining === null ? "∞" : row.remaining}
        </span>
      ),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {t("leaves.balances.title")}
          </DialogTitle>
          <DialogDescription>
            {t("leaves.balances.description")}
          </DialogDescription>
        </DialogHeader>

        <div data-testid="lv-balances-table">
          <DataTable
            columns={columns}
            rows={balances}
            isLoading={employees === undefined || requests === undefined}
            searchPlaceholder={t("common.search")}
            pageSize={100}
            emptyMessage={t("common.noData")}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
