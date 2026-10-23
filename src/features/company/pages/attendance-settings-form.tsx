/**
 * AttendanceSettingsForm — قواعد الدوام القابلة للتهيئة لكل شركة.
 *
 * لا يعرض Dialog بنفسه — المستهلك (صفحة الحضور) يلفه ويغلقه عند النجاح.
 * الحقول: بداية/نهاية الدوام · فترة السماح · أيام العمل (اصطلاح
 * getDay: 0=الأحد … 6=السبت) · تفعيل احتساب العمل الإضافي.
 *
 * القيم تأتي من useAttendanceSettings (أو الافتراضات عند غياب صف
 * الإعدادات) — الحفظ عبر useUpdateAttendanceSettings.
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
import { Switch } from "@/components/ui/switch"
import {
  useAttendanceSettings,
  useUpdateAttendanceSettings,
} from "@/features/company/data/queries"
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  timeToMinutes,
} from "@/features/company/lib/attendance-rules"
import { cn } from "@/lib/utils"
import type { UpdateAttendanceSettingsInput } from "@/types"

/** صيغة الوقت "HH:MM" 24 ساعة */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** كل أيام الأسبوع بترتيب getDay: 0=الأحد … 6=السبت */
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const

function buildSchema(t: (key: string) => string) {
  return z
    .object({
      work_start: z.string().regex(TIME_RE, { message: t("validation.timeInvalid") }),
      work_end: z.string().regex(TIME_RE, { message: t("validation.timeInvalid") }),
      // الحقل input number — سلسلة في النموذج (نفس نمط الراتب في EmployeeForm)
      late_grace_minutes: z.string().refine(
        (v) => {
          const n = Number(v)
          return Number.isInteger(n) && n >= 0 && n <= 240
        },
        { message: t("validation.graceInvalid") },
      ),
      work_days: z
        .array(z.number())
        .min(1, { message: t("validation.workDaysRequired") }),
      overtime_enabled: z.boolean(),
    })
    // نهاية الدوام يجب أن تلي بدايته
    .refine(
      (values) =>
        timeToMinutes(values.work_end) > timeToMinutes(values.work_start),
      { message: t("validation.workEndBeforeStart"), path: ["work_end"] },
    )
}

type SettingsFormValues = z.infer<ReturnType<typeof buildSchema>>

export interface AttendanceSettingsFormProps {
  /** يُستدعى بعد نجاح الحفظ — يغلق الـ Dialog مثلًا */
  onDone?: () => void
}

export function AttendanceSettingsForm({ onDone }: AttendanceSettingsFormProps) {
  const { t } = useTranslation()
  const { data: settings } = useAttendanceSettings()
  const updateSettings = useUpdateAttendanceSettings()

  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const defaultValues = useMemo<SettingsFormValues>(
    () => {
      const current = settings ?? DEFAULT_ATTENDANCE_SETTINGS
      return {
        work_start: current.work_start,
        work_end: current.work_end,
        late_grace_minutes: String(current.late_grace_minutes),
        work_days: [...current.work_days],
        overtime_enabled: current.overtime_enabled,
      }
    },
    [settings],
  )

  const form = useForm<SettingsFormValues>({ resolver, defaultValues })

  // عند وصول الإعدادات من الخادم (أو الافتراضات) نُعيد التهيئة
  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const watchedDays = form.watch("work_days")
  const watchedOvertime = form.watch("overtime_enabled")

  const toggleDay = (day: number) => {
    const current = form.getValues("work_days")
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)
    form.setValue("work_days", next, { shouldValidate: true })
  }

  const onSubmit = (values: SettingsFormValues) => {
    const input: UpdateAttendanceSettingsInput = {
      work_start: values.work_start,
      work_end: values.work_end,
      late_grace_minutes: Number(values.late_grace_minutes),
      work_days: values.work_days,
      overtime_enabled: values.overtime_enabled,
    }

    updateSettings.mutate(input, {
      onSuccess: () => {
        toast.success(t("attendance.settings.savedToast"), {
          description: `${values.work_start} – ${values.work_end}`,
        })
        onDone?.()
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  const fieldError = (name: keyof SettingsFormValues) =>
    form.formState.errors[name] ? (
      <p className="text-sm text-destructive">
        {form.formState.errors[name]?.message}
      </p>
    ) : null

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="att-workstart">
            {t("attendance.settings.workStart")}
          </Label>
          <Input
            id="att-workstart"
            type="time"
            dir="ltr"
            data-testid="att-settings-workstart"
            {...form.register("work_start")}
          />
          {fieldError("work_start")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-workend">{t("attendance.settings.workEnd")}</Label>
          <Input
            id="att-workend"
            type="time"
            dir="ltr"
            data-testid="att-settings-workend"
            {...form.register("work_end")}
          />
          {fieldError("work_end")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-grace">
            {t("attendance.settings.graceMinutes")}
          </Label>
          <Input
            id="att-grace"
            type="number"
            dir="ltr"
            min={0}
            max={240}
            step={5}
            data-testid="att-settings-grace"
            {...form.register("late_grace_minutes")}
          />
          {fieldError("late_grace_minutes")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="att-overtime">
            {t("attendance.settings.overtime")}
          </Label>
          <Switch
            id="att-overtime"
            data-testid="att-settings-overtime"
            checked={watchedOvertime}
            onCheckedChange={(checked) =>
              form.setValue("overtime_enabled", checked)
            }
          />
          {fieldError("overtime_enabled")}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("attendance.settings.workDays")}</Label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DAYS.map((day) => {
            const active = watchedDays.includes(day)
            return (
              <Button
                key={day}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                data-testid={`att-settings-day-${day}`}
                className={cn(!active && "text-muted-foreground")}
                onClick={() => toggleDay(day)}
              >
                {t(`attendance.days.${day}`)}
              </Button>
            )
          })}
        </div>
        {fieldError("work_days")}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={updateSettings.isPending}
          data-testid="att-settings-save"
        >
          {updateSettings.isPending
            ? t("common.loading")
            : t("common.save")}
        </Button>
      </div>
    </form>
  )
}
