/**
 * EmployeeProfilePage — ملف الموظف الشخصي (/app/m/employees/:employeeId).
 *
 * بطاقتان (بيانات التواصل + بيانات الوظيفة) مع وسم الحالة
 * وزر تعديل (RBAC) يفتح النموذج المشترك داخل Dialog.
 */

import { useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { ArrowLeft, BriefcaseBusiness, Pencil, UserRound } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/hooks/use-can"
import { permission } from "@/lib/rbac/permissions"
import {
  useDepartments,
  useEmployee,
  usePositions,
} from "@/features/company/data/queries"
import { appEnv } from "@/config/env"
import { DemoBanner } from "@/components/demo-banner"

import { EmployeeForm } from "./employee-form"
import { EmployeeStatusBadge } from "./employee-status-badge"

/** صف بيانات داخل بطاقة: تسمية على البداية وقيمة على النهاية */
function InfoRow({
  label,
  value,
  latin = false,
}: {
  label: string
  value: React.ReactNode
  /** القيم اللاتينية تُعرض باتجاه LTR */
  latin?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span
        className={`min-w-0 truncate text-sm font-medium ${
          latin ? "font-latin text-label" : ""
        }`}
        dir={latin ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  )
}

export function EmployeeProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { employeeId } = useParams()
  const isDemo = appEnv.companyMode === "demo"

  const { data: employee, isLoading } = useEmployee(employeeId ?? "")
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()
  const canEdit = useCan(permission("module:employees", "update"))

  const [editOpen, setEditOpen] = useState(false)

  const departmentName = useMemo(
    () =>
      departments?.find((d) => d.id === employee?.department_id)?.name ?? "—",
    [departments, employee],
  )
  const positionTitle = useMemo(
    () =>
      positions?.find((p) => p.id === employee?.position_id)?.title ??
      t("employee.positionNone"),
    [positions, employee, t],
  )

  const backLink = () => navigate("/app/m/employees")

  // ── تحميل: هياكل skeleton بنفس شكل البطاقات ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("modules.employees.name")} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  // ── غير موجود ──
  if (!employee) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("employee.profileTitle")} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {t("employee.notFound")}
            </p>
            <Button variant="outline" onClick={backLink}>
              <ArrowLeft className="rtl:rotate-180" />
              {t("employee.backToList")}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={employee.full_name}
        description={employee.job_title}
        actions={
          <>
            <Button variant="outline" onClick={backLink}>
              <ArrowLeft className="rtl:rotate-180" />
              {t("employee.backToList")}
            </Button>
            {canEdit.allowed ? (
              <Button onClick={() => setEditOpen(true)}>
                <Pencil className="size-4" />
                {t("common.edit")}
              </Button>
            ) : null}
          </>
        }
      />

      {isDemo ? <DemoBanner /> : null}

      {/* وسم الحالة تحت العنوان */}
      <EmployeeStatusBadge status={employee.status} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" />
              {t("employee.contactInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label={t("employee.email")}
              value={employee.email}
              latin
            />
            <InfoRow
              label={t("employee.phone")}
              value={employee.phone ?? "—"}
              latin
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BriefcaseBusiness className="size-4 text-primary" />
              {t("employee.employmentInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label={t("employee.code")}
              value={employee.employee_code}
              latin
            />
            <InfoRow label={t("employee.department")} value={departmentName} />
            <InfoRow label={t("employee.jobTitle")} value={employee.job_title} />
            <InfoRow label={t("employee.position")} value={positionTitle} />
            <InfoRow
              label={t("employee.hireDate")}
              value={employee.hire_date}
              latin
            />
            <InfoRow
              label={t("employee.salary")}
              value={
                employee.salary != null
                  ? `${employee.salary.toLocaleString("en-US")} EGP`
                  : "—"
              }
              latin
            />
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("employee.editTitle")}
            </DialogTitle>
            <DialogDescription>{t("employee.editDescription")}</DialogDescription>
          </DialogHeader>
          <EmployeeForm
            mode="edit"
            employee={employee}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
