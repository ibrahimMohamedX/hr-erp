/**
 * قسم الموظفين — القائمة الرئيسية:
 * جدول احترافي (رقم وظيفي، موظف، مسمى، إدارة، تعيين، راتب، حالة)
 * + بحث + فلترة بالإدارة والحالة معًا + ترتيب بالنقر على رأس العمود
 * + صف قابل للنقر يفتح الملف الشخصي + إضافة/تعديل عبر النموذج المشترك.
 */

import { useMemo, useState } from "react"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { Eye, Pencil, Plus } from "lucide-react"

import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { PageHeader } from "@/components/page-header"
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
  useDepartments,
  useEmployees,
} from "@/features/company/data/queries"
import { permission } from "@/lib/rbac/permissions"
import { appEnv } from "@/config/env"
import type { Employee, EmployeeStatus } from "@/types"

import { EmployeeForm } from "./employee-form"
import { EmployeeStatusBadge } from "./employee-status-badge"

const EMPLOYEE_STATUSES = [
  "active",
  "probation",
  "suspended",
  "terminated",
] as const satisfies readonly EmployeeStatus[]

export function EmployeesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isDemo = appEnv.companyMode === "demo"

  const { data: employees, isLoading } = useEmployees()
  const { data: departments } = useDepartments()
  const canCreate = useCan(permission("module:employees", "create"))
  const canEdit = useCan(permission("module:employees", "update"))

  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)

  const depName = useMemo(() => {
    const map = new Map<string, string>()
    departments?.forEach((d) => map.set(d.id, d.name))
    return map
  }, [departments])

  const openProfile = (id: string) =>
    navigate(`/app/m/employees/${encodeURIComponent(id)}`)

  // ── الأعمدة (متغيرات مسماة — تُستخدم أيضًا في الفلاتر) ──
  const codeColumn: DataTableColumn<Employee> = {
    id: "code",
    header: "#",
    className: "font-mono text-label text-muted-foreground",
    sortValue: (row) => row.employee_code,
    render: (row) => row.employee_code,
  }

  const nameColumn: DataTableColumn<Employee> = {
    id: "name",
    header: t("employee.name"),
    searchText: (row) => `${row.full_name} ${row.email}`,
    sortValue: (row) => row.full_name,
    render: (row) => (
      <div className="flex flex-col">
        <span className="font-medium">{row.full_name}</span>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {row.email}
        </span>
      </div>
    ),
  }

  const jobTitleColumn: DataTableColumn<Employee> = {
    id: "jobTitle",
    header: t("employee.jobTitle"),
    sortValue: (row) => row.job_title,
    render: (row) => row.job_title,
  }

  const departmentColumn: DataTableColumn<Employee> = {
    id: "department",
    header: t("employee.department"),
    filterValue: (row) => row.department_id,
    sortValue: (row) => depName.get(row.department_id) ?? "",
    render: (row) => depName.get(row.department_id) ?? "—",
  }

  const hireDateColumn: DataTableColumn<Employee> = {
    id: "hireDate",
    header: t("employee.hireDate"),
    className: "hidden font-latin text-label md:table-cell",
    sortValue: (row) => row.hire_date,
    render: (row) => row.hire_date,
  }

  const salaryColumn: DataTableColumn<Employee> = {
    id: "salary",
    header: t("employee.salary"),
    className: "hidden font-latin text-label lg:table-cell",
    sortValue: (row) => row.salary ?? 0,
    render: (row) =>
      row.salary != null
        ? `${row.salary.toLocaleString("en-US")} EGP`
        : "—",
  }

  const statusColumn: DataTableColumn<Employee> = {
    id: "status",
    header: t("table.status"),
    filterValue: (row) => row.status,
    sortValue: (row) => row.status,
    render: (row) => <EmployeeStatusBadge status={row.status} />,
  }

  const actionsColumn: DataTableColumn<Employee> = {
    id: "actions",
    header: t("common.actions"),
    className: "w-24",
    render: (row) => (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={t("employee.openProfile")}
          title={t("employee.openProfile")}
          onClick={(e) => {
            e.stopPropagation()
            openProfile(row.id)
          }}
        >
          <Eye className="size-4" />
        </Button>
        {canEdit.allowed ? (
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("common.edit")}
            title={t("common.edit")}
            onClick={(e) => {
              e.stopPropagation()
              setEditing(row)
            }}
          >
            <Pencil className="size-4" />
          </Button>
        ) : null}
      </div>
    ),
  }

  const columns: Array<DataTableColumn<Employee>> = [
    codeColumn,
    nameColumn,
    jobTitleColumn,
    departmentColumn,
    hireDateColumn,
    salaryColumn,
    statusColumn,
    actionsColumn,
  ]

  // ── الفلاتر: الإدارة والحالة معًا (AND) ──
  const filters: Array<DataTableFilter<Employee>> = [
    {
      column: departmentColumn,
      options: (departments ?? []).map((d) => ({
        value: d.id,
        label: d.name,
      })),
    },
    {
      column: statusColumn,
      options: EMPLOYEE_STATUSES.map((s) => ({
        value: s,
        label: t(`employee.status.${s}`),
      })),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.employees.name")}
        description={t("modules.employees.description")}
      />

      {isDemo ? <DemoBanner /> : null}

      <DataTable
        columns={columns}
        rows={employees ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("employee.searchPlaceholder")}
        filters={filters}
        onRowClick={(row) => openProfile(row.id)}
        toolbarActions={
          canCreate.allowed ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              {t("employee.add")}
            </Button>
          ) : null
        }
      />

      {/* إضافة موظف جديد */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("employee.addTitle")}
            </DialogTitle>
            <DialogDescription>{t("employee.addDescription")}</DialogDescription>
          </DialogHeader>
          <EmployeeForm mode="create" onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* تعديل موظف من الصف */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("employee.editTitle")}
            </DialogTitle>
            <DialogDescription>{t("employee.editDescription")}</DialogDescription>
          </DialogHeader>
          {editing ? (
            <EmployeeForm
              key={editing.id}
              mode="edit"
              employee={editing}
              onDone={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
