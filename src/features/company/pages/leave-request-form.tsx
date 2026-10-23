/**
 * LeaveRequestForm — نموذج مشترك لتقديم/تعديل طلب إجازة.
 *
 * نفس فلسفة AttendanceRecordForm: لا يعرض Dialog بنفسه — المستهلك
 * (صفحة الإجازات) يلفه داخل Dialog ويمرر onDone لإغلاقه عند النجاح.
 *
 * الحقول: الموظف · نوع الإجازة · من/إلى · السبب، مع معاينة حية
 * لأيام العمل (حسب أيام دوام الشركة) والرصيد المتبقي قبل التقديم.
 *
 * التحقق الموحد (تواريخ/أيام عمل/تداخل/رصيد) يجري في طبقة البيانات
 * عبر محرك leave-rules — الواجهة تعرض تلميحًا استباقيًا فقط.
 *
 * يصدّر أيضًا mapLeaveError: مترجم رسائل عقد الـ API الموحدة
 * (Error.message حرفيًا) إلى مفاتيح i18n — تستخدمه كل واجهات الإجازات.
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
  useAttendanceSettings,
  useCreateLeaveRequest,
  useEmployees,
  useLeaveRequests,
  useLeaveTypes,
  useUpdateLeaveRequest,
} from "@/features/company/data/queries"
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  localToday,
} from "@/features/company/lib/attendance-rules"
import {
  countWorkingDays,
  parseLocalDate,
  sumApprovedLeaveDays,
} from "@/features/company/lib/leave-rules"
import { appEnv } from "@/config/env"
import type {
  CreateLeaveRequestInput,
  LeaveRequest,
} from "@/types"

/**
 * مترجم رسائل عقد الـ API الموحدة → مفتاح i18n مفهوم للعربية.
 * العقد (live وdemo بنفس النص حرفيًا): انظر features/company/data/company-api.ts
 */
export function mapLeaveError(
  t: (key: string) => string,
  message: unknown,
): string {
  const raw = message instanceof Error ? message.message : String(message ?? "")
  const keyByMessage: Record<string, string> = {
    "Leave request not found": "leaves.errors.requestNotFound",
    "Leave type not found": "leaves.errors.typeNotFound",
    "Leave type already exists": "leaves.errors.typeExists",
    "Leave type has requests": "leaves.errors.typeHasRequests",
    "End date before start date": "leaves.errors.endBeforeStart",
    "No working days in range": "leaves.errors.noWorkingDays",
    "Leave request overlaps existing dates": "leaves.errors.overlap",
    "Insufficient leave balance": "leaves.errors.balance",
    "Only pending requests can be modified": "leaves.errors.onlyPendingModify",
    "Only pending requests can be decided": "leaves.errors.onlyPendingDecide",
    "Only pending or approved requests can be cancelled":
      "leaves.errors.onlyPendOrAppCancel",
    "Rejection reason is required": "leaves.errors.reasonRequired",
    "Only approved requests can be synced to attendance":
      "leaves.errors.onlyApprovedSync",
  }
  const key = keyByMessage[raw]
  return key ? t(key) : t("common.error")
}

/** رسائل التحقق تُبنى باللغة الحالية — resolver inline يتبع اللغة دائمًا */
function buildSchema(t: (key: string) => string) {
  return z
    .object({
      employee_id: z
        .string()
        .min(1, { message: t("validation.employeeRequired") }),
      leave_type_id: z
        .string()
        .min(1, { message: t("validation.leaveTypeRequired") }),
      start_date: z.string().min(1, { message: t("validation.dateRequired") }),
      end_date: z.string().min(1, { message: t("validation.dateRequired") }),
      reason: z.string().optional(),
    })
    .refine((values) => values.end_date >= values.start_date, {
      message: t("validation.endBeforeStart"),
      path: ["end_date"],
    })
}

type LeaveFormValues = z.infer<ReturnType<typeof buildSchema>>

export interface LeaveRequestFormProps {
  mode: "create" | "edit"
  /** مطلوب في وضع edit — الطلب الجاري تعديله */
  request?: LeaveRequest
  /** يُستدعى بعد نجاح الحفظ — يغلق الـ Dialog مثلًا */
  onDone?: () => void
}

export function LeaveRequestForm({
  mode,
  request,
  onDone,
}: LeaveRequestFormProps) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"

  const createLeave = useCreateLeaveRequest()
  const updateLeave = useUpdateLeaveRequest()
  const { data: employees } = useEmployees()
  const { data: types } = useLeaveTypes()
  const { data: allRequests } = useLeaveRequests()
  const { data: attendanceSettings } = useAttendanceSettings()

  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const defaultValues = useMemo<LeaveFormValues>(
    () =>
      mode === "edit" && request
        ? {
            employee_id: request.employee_id,
            leave_type_id: request.leave_type_id,
            start_date: request.start_date,
            end_date: request.end_date,
            reason: request.reason ?? "",
          }
        : {
            employee_id: "",
            leave_type_id: "",
            start_date: localToday(),
            end_date: localToday(),
            reason: "",
          },
    [mode, request],
  )

  const form = useForm<LeaveFormValues>({ resolver, defaultValues })

  // إعادة التهيئة عند فتح النموذج على طلب مختلف
  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const workDays = attendanceSettings?.work_days ?? DEFAULT_ATTENDANCE_SETTINGS.work_days

  // الأنواع النشطة فقط للطلبات الجديدة — التعديل يعرض نوع الطلب الحالي أيضًا
  const selectableTypes = useMemo(() => {
    const active = (types ?? []).filter((x) => x.is_active)
    if (mode === "edit" && request) {
      const current = (types ?? []).find((x) => x.id === request.leave_type_id)
      if (current && !current.is_active) return [current, ...active]
    }
    return active
  }, [types, mode, request])

  // الموظفون النشطون/تحت التجربة في الإنشاء — الكل في التعديل
  const selectableEmployees = useMemo(
    () =>
      mode === "edit"
        ? (employees ?? [])
        : (employees ?? []).filter(
            (e) => e.status === "active" || e.status === "probation",
          ),
    [employees, mode],
  )

  // ── معاينة حية: أيام العمل والرصيد المتبقي قبل التقديم ──
  const watched = form.watch()
  const preview = useMemo(() => {
    const days = countWorkingDays(
      watched.start_date,
      watched.end_date,
      workDays,
    )
    const type = (types ?? []).find((x) => x.id === watched.leave_type_id)
    let remaining: number | null = null
    if (type && type.annual_days !== null && watched.employee_id) {
      const year = parseLocalDate(watched.start_date).getFullYear()
      const used = sumApprovedLeaveDays(
        allRequests ?? [],
        watched.employee_id,
        type.id,
        year,
        mode === "edit" ? request?.id : undefined,
      )
      remaining = type.annual_days - used
    }
    return { days, remaining, unlimited: type ? type.annual_days === null : false }
  }, [
    watched.start_date,
    watched.end_date,
    watched.leave_type_id,
    watched.employee_id,
    types,
    allRequests,
    workDays,
    mode,
    request,
  ])

  const isPending = createLeave.isPending || updateLeave.isPending

  const onSubmit = (values: LeaveFormValues) => {
    const input: CreateLeaveRequestInput = {
      employee_id: values.employee_id,
      leave_type_id: values.leave_type_id,
      start_date: values.start_date,
      end_date: values.end_date,
      reason: values.reason?.trim() ? values.reason.trim() : null,
    }
    const employeeName =
      employees?.find((e) => e.id === values.employee_id)?.full_name ?? "—"
    const typeName =
      types?.find((x) => x.id === values.leave_type_id)?.name ?? "—"
    const description = `${employeeName} · ${typeName} — ${values.start_date} → ${values.end_date}${
      isDemo ? ` · ${t("demo.toastSuffix")}` : ""
    }`

    if (mode === "edit" && request) {
      updateLeave.mutate(
        { id: request.id, input },
        {
          onSuccess: () => {
            toast.success(t("leaves.updatedToast"), { description })
            onDone?.()
          },
          onError: (error) => toast.error(mapLeaveError(t, error)),
        },
      )
      return
    }

    createLeave.mutate(input, {
      onSuccess: () => {
        toast.success(t("leaves.createdToast"), { description })
        form.reset(defaultValues)
        onDone?.()
      },
      onError: (error) => toast.error(mapLeaveError(t, error)),
    })
  }

  const fieldError = (name: keyof LeaveFormValues) =>
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
            value={watched.employee_id}
            onValueChange={(v) => form.setValue("employee_id", v)}
          >
            <SelectTrigger className="w-full" data-testid="lv-form-employee">
              <SelectValue placeholder={t("employee.searchPlaceholder")} />
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
          <Label>{t("leaves.typeLabel")}</Label>
          <Select
            value={watched.leave_type_id}
            onValueChange={(v) => form.setValue("leave_type_id", v)}
          >
            <SelectTrigger className="w-full" data-testid="lv-form-type">
              <SelectValue placeholder={t("leaves.typePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {selectableTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldError("leave_type_id")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lv-from">{t("leaves.startDate")}</Label>
          <Input
            id="lv-from"
            type="date"
            dir="ltr"
            data-testid="lv-form-from"
            {...form.register("start_date")}
          />
          {fieldError("start_date")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lv-to">{t("leaves.endDate")}</Label>
          <Input
            id="lv-to"
            type="date"
            dir="ltr"
            data-testid="lv-form-to"
            {...form.register("end_date")}
          />
          {fieldError("end_date")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lv-days">{t("leaves.workDays")}</Label>
          <Input
            id="lv-days"
            readOnly
            dir="ltr"
            className="bg-muted/50"
            data-testid="lv-form-days"
            value={
              watched.end_date < watched.start_date
                ? "—"
                : String(preview.days)
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lv-balance">{t("leaves.balanceBefore")}</Label>
          <p
            id="lv-balance"
            dir="ltr"
            data-testid="lv-form-balance"
            className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium"
          >
            {watched.employee_id && watched.leave_type_id
              ? preview.unlimited
                ? "∞"
                : String(preview.remaining)
              : "—"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lv-reason">{t("leaves.reason")}</Label>
        <Textarea
          id="lv-reason"
          rows={2}
          placeholder={t("leaves.reasonPlaceholder")}
          data-testid="lv-form-reason"
          {...form.register("reason")}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending} data-testid="lv-form-submit">
          {isPending
            ? t("common.loading")
            : mode === "edit"
              ? t("common.save")
              : t("leaves.newRequest")}
        </Button>
      </div>
    </form>
  )
}
