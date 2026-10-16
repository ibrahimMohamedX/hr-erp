/**
 * قسم الموظفين — الصفحة الفعلية الكاملة:
 * جدول احترافي (كود، موظف، وظيفة، إدارة، تعيين، راتب، حالة)
 * + بحث + فلترة بالإدارة والحالة + إضافة موظف جديد عبر نموذج مُتحقق.
 */

import { z } from "zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Plus } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  useCreateEmployee,
  useDepartments,
  useEmployees,
} from "@/features/company/data/queries"
import { useCan } from "@/features/auth/hooks/use-can"
import { permission } from "@/lib/rbac/permissions"
import { cn } from "@/lib/utils"
import type { CreateEmployeeInput, Employee, EmployeeStatus } from "@/types"

const employeeStatusStyles: Record<EmployeeStatus, string> = {
  active: "border-ok/40 text-ok",
  probation: "border-arc/40 text-arc",
  suspended: "border-warn/50 text-warn",
  terminated: "border-muted-foreground/30 text-muted-foreground",
}

function StatusBadge({ status }: { status: EmployeeStatus }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px]", employeeStatusStyles[status])}
    >
      {t(`employee.status.${status}`)}
    </Badge>
  )
}

const addEmployeeSchema = z.object({
  full_name: z.string().min(3, { message: "الاسم الكامل مطلوب" }),
  email: z.email({ message: "بريد إلكتروني غير صالح" }),
  job_title: z.string().min(2, { message: "المسمى الوظيفي مطلوب" }),
  department_id: z.string().min(1, { message: "اختر الإدارة" }),
  hire_date: z.string().min(1, { message: "تاريخ التعيين مطلوب" }),
  salary: z
    .string()
    .optional()
    .refine((v) => !v || Number(v) > 0, { message: "قيمة غير صالحة" }),
})

type AddEmployeeForm = z.infer<typeof addEmployeeSchema>

function AddEmployeeDialog({ departments }: { departments: { id: string; name: string }[] }) {
  const { t } = useTranslation()
  const createEmployee = useCreateEmployee()

  const form = useForm<AddEmployeeForm>({
    resolver: zodResolver(addEmployeeSchema),
    defaultValues: {
      full_name: "",
      email: "",
      job_title: "",
      department_id: "",
      hire_date: new Date().toISOString().slice(0, 10),
      salary: "",
    },
  })

  const onSubmit = (values: AddEmployeeForm) => {
    const input: CreateEmployeeInput = {
      full_name: values.full_name,
      email: values.email,
      job_title: values.job_title,
      department_id: values.department_id,
      hire_date: values.hire_date,
      salary: values.salary ? Number(values.salary) : null,
    }
    createEmployee.mutate(input, {
      onSuccess: (employee) => {
        toast.success(t("employee.createdToast"), {
          description: `${employee.full_name} · ${employee.employee_code} — ${t("demo.toastSuffix")}`,
        })
        form.reset()
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("employee.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {t("employee.addTitle")}
          </DialogTitle>
          <DialogDescription>{t("employee.addDescription")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="emp-name">{t("employee.name")}</Label>
              <Input
                id="emp-name"
                placeholder={t("employee.namePlaceholder")}
                {...form.register("full_name")}
              />
              {form.formState.errors.full_name ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-email">{t("employee.email")}</Label>
              <Input
                id="emp-email"
                type="email"
                dir="ltr"
                placeholder="name@company.com"
                {...form.register("email")}
              />
              {form.formState.errors.email ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-title">{t("employee.jobTitle")}</Label>
              <Input
                id="emp-title"
                placeholder={t("employee.jobTitlePlaceholder")}
                {...form.register("job_title")}
              />
              {form.formState.errors.job_title ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.job_title.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>{t("employee.department")}</Label>
              <Select
                value={form.watch("department_id")}
                onValueChange={(v) => form.setValue("department_id", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("employee.departmentPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dep) => (
                    <SelectItem key={dep.id} value={dep.id}>
                      {dep.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.department_id ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.department_id.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="emp-hire">{t("employee.hireDate")}</Label>
              <Input
                id="emp-hire"
                type="date"
                dir="ltr"
                {...form.register("hire_date")}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="emp-salary">{t("employee.salary")}</Label>
              <Input
                id="emp-salary"
                type="number"
                dir="ltr"
                placeholder="25000"
                {...form.register("salary")}
              />
              {form.formState.errors.salary ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.salary.message}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createEmployee.isPending}>
              {createEmployee.isPending
                ? t("common.loading")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EmployeesPage() {
  const { t } = useTranslation()
  const { data: employees, isLoading } = useEmployees()
  const { data: departments } = useDepartments()
  const canCreate = useCan(permission("module:employees", "create"))

  const depName = useMemo(() => {
    const map = new Map<string, string>()
    departments?.forEach((d) => map.set(d.id, d.name))
    return map
  }, [departments])

  const columns: Array<DataTableColumn<Employee>> = [
    {
      id: "code",
      header: "#",
      className: "font-mono text-label text-muted-foreground",
      render: (row) => row.employee_code,
    },
    {
      id: "name",
      header: t("employee.name"),
      searchText: (row) => `${row.full_name} ${row.email}`,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.full_name}</span>
          <span className="text-xs text-muted-foreground" dir="ltr">
            {row.email}
          </span>
        </div>
      ),
    },
    {
      id: "jobTitle",
      header: t("employee.jobTitle"),
      render: (row) => row.job_title,
    },
    {
      id: "department",
      header: t("employee.department"),
      filterValue: (row) => row.department_id,
      render: (row) => depName.get(row.department_id) ?? "—",
    },
    {
      id: "hireDate",
      header: t("employee.hireDate"),
      className: "hidden font-latin text-label md:table-cell",
      render: (row) => row.hire_date,
    },
    {
      id: "salary",
      header: t("employee.salary"),
      className: "hidden font-latin text-label lg:table-cell",
      render: (row) =>
        row.salary
          ? `${row.salary.toLocaleString("en-US")} EGP`
          : "—",
    },
    {
      id: "status",
      header: t("table.status"),
      filterValue: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ]

  const departmentFilter = departments
    ? {
        column: columns[3],
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      }
    : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.employees.name")}
        description={t("modules.employees.description")}
      />

      <DemoBanner />

      <DataTable
        columns={columns}
        rows={employees ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("employee.searchPlaceholder")}
        filter={departmentFilter}
        toolbarActions={
          canCreate.allowed ? (
            <AddEmployeeDialog
              departments={
                departments?.map((d) => ({ id: d.id, name: d.name })) ?? []
              }
            />
          ) : null
        }
      />
    </div>
  )
}
