/**
 * AttendanceRecordForm — نموذج مشترك لإضافة/تعديل سجل حضور يدويًا.
 *
 * نفس فلسفة EmployeeForm: لا يعرض Dialog بنفسه — المستهلك (صفحة الحضور)
 * يلفه داخل Dialog ويمرر onDone لإغلاقه عند النجاح.
 *
 * الحقول: الموظف · التاريخ · الحالة · وقت الحضور · وقت الانصراف · ملاحظة.
 * في الإنشاء تُعرض الموظفون النشطون/تحت التجربة فقط؛ في التعديل الكل
 * (سجل موجود أصلًا لموظف ربما تغيرت حالته الوظيفية).
 *
 * يصدّر أيضًا mapAttendanceError: مترجم رسائل عقد الـ API الموحدة
 * (Error.message حرفيًا) إلى مفاتيح i18n — تستخدمه كل واجهات الحضور.
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
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateAttendance,
  useEmployees,
  useUpdateAttendance,
} from "@/features/company/data/queries"
import { localToday, timeToMinutes } from "@/features/company/lib/attendance-rules"
import { appEnv } from "@/config/env"
import type { AttendanceRecord, AttendanceStatus, CreateAttendanceInput } from "@/types"

const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent",
  "on_leave",
] as const satisfies readonly AttendanceStatus[]

/** صيغة الوقت "HH:MM" 24 ساعة — حقل الإدخال type="time" يعيدها دائمًا */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * مترجم رسائل عقد الـ API الموحدة → مفتاح i18n مفهوم للعربية.
 * العقد (live وdemo بنفس النص حرفيًا): انظر features/company/data/company-api.ts
 */
export function mapAttendanceError(
  t: (key: string) => string,
  message: unknown,
): string {
  const raw = message instanceof Error ? message.message : String(message ?? "")
  const keyByMessage: Record<string, string> = {
    "Attendance record already exists": "attendance.errors.alreadyExists",
    "Attendance record not found": "attendance.errors.notFound",
    "No check-in today": "attendance.errors.noCheckIn",
    "Already checked in today": "attendance.errors.alreadyCheckedIn",
    "Already checked out": "attendance.errors.alreadyCheckedOut",
  }
  const key = keyByMessage[raw]
  return key ? t(key) : t("common.error")
}

/** رسائل التحقق تُبنى باللغة الحالية — resolver inline يتبع اللغة دائمًا */
function buildSchema(t: (key: string) => string) {
  const timeOrEmpty = (v: string | undefined) => !v || TIME_RE.test(v)
  return z
    .object({
      employee_id: z.string().min(1, { message: t("validation.employeeRequired") }),
      date: z.string().min(1, { message: t("validation.dateRequired") }),
      status: z.enum(ATTENDANCE_STATUSES),
      check_in: z
        .string()
        .optional()
        .refine(timeOrEmpty, { message: t("validation.timeInvalid") }),
      check_out: z
        .string()
        .optional()
        .refine(timeOrEmpty, { message: t("validation.timeInvalid") }),
      note: z.string().optional(),
    })
    // لو الوقتان معًا: الانصراف بعد الحضور (بالدقائق — مصدر الحساب الموحد)
    .refine(
      (values) =>
        !values.check_in ||
        !values.check_out ||
        timeToMinutes(values.check_out) > timeToMinutes(values.check_in),
      { message: t("validation.checkOutBeforeIn"), path: ["check_out"] },
    )
}

type AttendanceFormValues = z.infer<ReturnType<typeof buildSchema>>

export interface AttendanceRecordFormProps {
  mode: "create" | "edit"
  /** مطلوب في وضع edit — السجل الجاري تعديله */
  record?: AttendanceRecord
  /** يُستدعى بعد نجاح الحفظ — يغلق الـ Dialog مثلًا */
  onDone?: () => void
}

export function AttendanceRecordForm({
  mode,
  record,
  onDone,
}: AttendanceRecordFormProps) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"

  const createAttendance = useCreateAttendance()
  const updateAttendance = useUpdateAttendance()
  const { data: employees } = useEmployees()

  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const defaultValues = useMemo<AttendanceFormValues>(
    () =>
      mode === "edit" && record
        ? {
            employee_id: record.employee_id,
            date: record.date,
            status: record.status,
            check_in: record.check_in ?? "",
            check_out: record.check_out ?? "",
            note: record.note ?? "",
          }
        : {
            employee_id: "",
            date: localToday(),
            status: "present",
            check_in: "",
            check_out: "",
            note: "",
          },
    [mode, record],
  )

  const form = useForm<AttendanceFormValues>({ resolver, defaultValues })

  // إعادة التهيئة عند فتح النموذج على سجل مختلف
  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  // قائمة الموظفين: النشطون/تحت التجربة في الإنشاء — الكل في التعديل
  const selectableEmployees = useMemo(
    () =>
      mode === "edit"
        ? (employees ?? [])
        : (employees ?? []).filter(
            (e) => e.status === "active" || e.status === "probation",
          ),
    [employees, mode],
  )

  const isPending = createAttendance.isPending || updateAttendance.isPending

  const onSubmit = (values: AttendanceFormValues) => {
    const input: CreateAttendanceInput = {
      employee_id: values.employee_id,
      date: values.date,
      status: values.status,
      check_in: values.check_in || null,
      check_out: values.check_out || null,
      note: values.note?.trim() ? values.note.trim() : null,
    }
    const employeeName =
      employees?.find((e) => e.id === values.employee_id)?.full_name ?? "—"

    const description = `${employeeName} · ${values.date}${
      isDemo ? ` — ${t("demo.toastSuffix")}` : ""
    }`

    if (mode === "edit" && record) {
      updateAttendance.mutate(
        { id: record.id, input },
        {
          onSuccess: () => {
            toast.success(t("attendance.updatedToast"), { description })
            onDone?.()
          },
          onError: (error) =>
            toast.error(mapAttendanceError(t, error)),
        },
      )
      return
    }

    createAttendance.mutate(input, {
      onSuccess: () => {
        toast.success(t("attendance.createdToast"), { description })
        form.reset(defaultValues)
        onDone?.()
      },
      onError: (error) => toast.error(mapAttendanceError(t, error)),
    })
  }

  const fieldError = (name: keyof AttendanceFormValues) =>
    form.formState.errors[name] ? (
      <p className="text-sm text-destructive">
        {form.formState.errors[name]?.message}
      </p>
    ) : null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("attendance.pickEmployee")}</Label>
          <Select
            value={form.watch("employee_id")}
            onValueChange={(v) => form.setValue("employee_id", v)}
          >
            <SelectTrigger className="w-full" data-testid="att-form-employee">
              <SelectValue placeholder={t("attendance.pickEmployee")} />
            </SelectTrigger>
            <SelectContent>
              {selectableEmployees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("employee_id")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-date">{t("attendance.recordDate")}</Label>
          <Input
            id="att-date"
            type="date"
            dir="ltr"
            data-testid="att-form-date"
            {...form.register("date")}
          />
          {fieldError("date")}
        </div>

        <div className="space-y-2">
          <Label>{t("table.status")}</Label>
          <Select
            value={form.watch("status")}
            onValueChange={(v) =>
              form.setValue("status", v as AttendanceFormValues["status"])
            }
          >
            <SelectTrigger className="w-full" data-testid="att-form-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ATTENDANCE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {t(`attendance.status.${s}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-note">{t("attendance.note")}</Label>
          <Textarea
            id="att-note"
            rows={2}
            placeholder={t("attendance.notePlaceholder")}
            data-testid="att-form-note"
            {...form.register("note")}
          />
          {fieldError("note")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-checkin">{t("attendance.checkIn")}</Label>
          <Input
            id="att-checkin"
            type="time"
            dir="ltr"
            data-testid="att-form-checkin"
            {...form.register("check_in")}
          />
          {fieldError("check_in")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-checkout">{t("attendance.checkOut")}</Label>
          <Input
            id="att-checkout"
            type="time"
            dir="ltr"
            data-testid="att-form-checkout"
            {...form.register("check_out")}
          />
          {fieldError("check_out")}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending} data-testid="att-form-submit">
          {isPending
            ? t("common.loading")
            : mode === "edit"
              ? t("common.save")
              : t("attendance.addRecord")}
        </Button>
      </div>
    </form>
  )
}
