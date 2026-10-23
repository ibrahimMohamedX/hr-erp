/**
 * EmployeeForm — نموذج مشترك لإضافة/تعديل موظف.
 *
 * لا يعرض Dialog بنفسه — المستهلك (قائمة الموظفين أو الملف الشخصي)
 * يلفه داخل Dialog ويمرر onDone لإغلاقه عند النجاح.
 *
 * الحقول الكاملة: الاسم، البريد، الهاتف، القسم، المنصب المعتمد،
 * المسمى الوظيفي، الحالة الوظيفية، تاريخ التعيين، الراتب.
 * اختيار منصب معتمد يملأ المسمى الوظيفي تلقائيًا (ويبقى قابلًا للتعديل).
 */

import { z } from "zod"
import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
  usePositions,
  useUpdateEmployee,
} from "@/features/company/data/queries"
import { appEnv } from "@/config/env"
import type { CreateEmployeeInput, Employee, EmployeeStatus } from "@/types"

const EMPLOYEE_STATUSES = [
  "active",
  "probation",
  "suspended",
  "terminated",
] as const satisfies readonly EmployeeStatus[]

/** قيمة الحارس لخيار «بدون منصب» — Radix Select لا يقبل قيمة فارغة */
const NO_POSITION = "__none__"

/** رسائل التحقق تُبنى باللغة الحالية — resolver inline يتبع اللغة دائمًا */
function buildSchema(t: (key: string) => string) {
  return z.object({
    full_name: z.string().min(3, { message: t("validation.nameRequired") }),
    email: z.email({ message: t("validation.emailInvalid") }),
    phone: z
      .string()
      .optional()
      .refine((v) => !v || /^[+]?[\d\s-]{7,20}$/.test(v.trim()), {
        message: t("validation.phoneInvalid"),
      }),
    job_title: z.string().min(2, { message: t("validation.jobTitleRequired") }),
    department_id: z
      .string()
      .min(1, { message: t("validation.departmentRequired") }),
    position_id: z.string().optional(),
    hire_date: z.string().min(1, { message: t("validation.dateRequired") }),
    salary: z
      .string()
      .optional()
      .refine((v) => !v || Number(v) > 0, {
        message: t("validation.salaryInvalid"),
      }),
    status: z.enum(EMPLOYEE_STATUSES),
  })
}

type EmployeeFormValues = z.infer<ReturnType<typeof buildSchema>>

export interface EmployeeFormProps {
  mode: "create" | "edit"
  /** مطلوب في وضع edit — الموظف الجاري تعديله */
  employee?: Employee
  /** يُستدعى بعد نجاح الحفظ — يغلق الـ Dialog مثلًا */
  onDone?: () => void
}

export function EmployeeForm({ mode, employee, onDone }: EmployeeFormProps) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"

  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()
  const { data: departments } = useDepartments()
  const { data: positions } = usePositions()

  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const defaultValues = useMemo<EmployeeFormValues>(
    () =>
      mode === "edit" && employee
        ? {
            full_name: employee.full_name,
            email: employee.email,
            phone: employee.phone ?? "",
            job_title: employee.job_title,
            department_id: employee.department_id,
            position_id: employee.position_id ?? "",
            hire_date: employee.hire_date,
            salary: employee.salary != null ? String(employee.salary) : "",
            status: employee.status,
          }
        : {
            full_name: "",
            email: "",
            phone: "",
            job_title: "",
            department_id: "",
            position_id: "",
            hire_date: new Date().toISOString().slice(0, 10),
            salary: "",
            status: "probation",
          },
    [mode, employee],
  )

  const form = useForm<EmployeeFormValues>({ resolver, defaultValues })

  // إعادة التهيئة عند فتح النموذج على موظف مختلف
  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const watchedDepartmentId = form.watch("department_id")
  const watchedPositionId = form.watch("position_id") ?? ""

  // المناصب المتاحة: عامة (بدون قسم) أو تابعة للقسم المختار
  // — مع إبقاء المنصب المحفوظ ظاهرًا في وضع التعديل
  const availablePositions = useMemo(() => {
    const current = mode === "edit" ? (employee?.position_id ?? null) : null
    return (positions ?? []).filter(
      (p) =>
        p.department_id === null ||
        p.department_id === watchedDepartmentId ||
        p.id === current,
    )
  }, [positions, watchedDepartmentId, mode, employee])

  const isPending = createEmployee.isPending || updateEmployee.isPending

  const onSubmit = (values: EmployeeFormValues) => {
    const input: CreateEmployeeInput = {
      full_name: values.full_name,
      email: values.email,
      phone: values.phone?.trim() ? values.phone.trim() : null,
      job_title: values.job_title,
      department_id: values.department_id,
      position_id: values.position_id || null,
      hire_date: values.hire_date,
      salary: values.salary ? Number(values.salary) : null,
      status: values.status,
    }

    if (mode === "edit" && employee) {
      updateEmployee.mutate(
        { id: employee.id, input },
        {
          onSuccess: () => {
            toast.success(t("employee.editToast"), {
              description: `${input.full_name}${
                isDemo ? ` — ${t("demo.toastSuffix")}` : ""
              }`,
            })
            onDone?.()
          },
          onError: () => toast.error(t("common.error")),
        },
      )
      return
    }

    createEmployee.mutate(input, {
      onSuccess: (created) => {
        toast.success(t("employee.createdToast"), {
          description: `${created.full_name} · ${created.employee_code}${
            isDemo ? ` — ${t("demo.toastSuffix")}` : ""
          }`,
        })
        form.reset(defaultValues)
        onDone?.()
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  const fieldError = (name: keyof EmployeeFormValues) =>
    form.formState.errors[name] ? (
      <p className="text-sm text-destructive">
        {form.formState.errors[name]?.message}
      </p>
    ) : null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="emp-name">{t("employee.name")}</Label>
          <Input
            id="emp-name"
            placeholder={t("employee.namePlaceholder")}
            {...form.register("full_name")}
          />
          {fieldError("full_name")}
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
          {fieldError("email")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-phone">{t("employee.phone")}</Label>
          <Input
            id="emp-phone"
            dir="ltr"
            placeholder={t("employee.phonePlaceholder")}
            {...form.register("phone")}
          />
          {fieldError("phone")}
        </div>

        <div className="space-y-2">
          <Label>{t("employee.department")}</Label>
          <Select
            value={form.watch("department_id")}
            onValueChange={(v) => {
              form.setValue("department_id", v)
              // تغيير القسم يُفرغ المنصب المختار إن لم يعد متاحًا
              const stillValid =
                v === "" ||
                (positions ?? []).some(
                  (p) => p.id === watchedPositionId &&
                    (p.department_id === null || p.department_id === v),
                )
              if (!stillValid) form.setValue("position_id", "")
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("employee.departmentPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {(departments ?? []).map((dep) => (
                <SelectItem key={dep.id} value={dep.id}>
                  {dep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("department_id")}
        </div>

        <div className="space-y-2">
          <Label>{t("employee.position")}</Label>
          <Select
            value={watchedPositionId || NO_POSITION}
            onValueChange={(v) => {
              const actual = v === NO_POSITION ? "" : v
              form.setValue("position_id", actual)
              // اختيار منصب معتمد يملأ المسمى الوظيفي (يبقى قابلًا للتعديل)
              if (actual) {
                const position = positions?.find((p) => p.id === actual)
                if (position) form.setValue("job_title", position.title)
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("employee.positionPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_POSITION}>
                {t("employee.positionNone")}
              </SelectItem>
              {availablePositions.map((pos) => (
                <SelectItem key={pos.id} value={pos.id}>
                  {pos.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-title">{t("employee.jobTitle")}</Label>
          <Input
            id="emp-title"
            placeholder={t("employee.jobTitlePlaceholder")}
            {...form.register("job_title")}
          />
          {fieldError("job_title")}
        </div>

        <div className="space-y-2">
          <Label>{t("employee.statusLabel")}</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(v) =>
              form.setValue("status", v as EmployeeFormValues["status"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`employee.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-hire">{t("employee.hireDate")}</Label>
          <Input id="emp-hire" type="date" dir="ltr" {...form.register("hire_date")} />
          {fieldError("hire_date")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="emp-salary">{t("employee.salary")}</Label>
          <Input
            id="emp-salary"
            type="number"
            dir="ltr"
            placeholder="25000"
            {...form.register("salary")}
          />
          {fieldError("salary")}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? t("common.loading")
            : mode === "edit"
              ? t("common.save")
              : t("employee.add")}
        </Button>
      </div>
    </form>
  )
}
