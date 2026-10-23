/**
 * AttendanceCheckDialog — حوارية موحّدة لتسجيل حضور/انصراف سريع لموظف.
 *
 * mode "in" → useCheckIn (وقت الآن + اشتقاق الحالة من قواعد الدوام)
 * mode "out" → useCheckOut (يتطلب حضورًا اليوم بلا انصراف)
 * الموظفون المعروضون: النشطون/تحت التجربة فقط — التسجيل عملية يومية
 * للقوى العاملة الفعلية. رسائل عقد الأخطاء تُترجم عبر mapAttendanceError.
 */

import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCheckIn, useCheckOut, useEmployees } from "@/features/company/data/queries"
import { appEnv } from "@/config/env"

import { mapAttendanceError } from "./attendance-record-form"

export interface AttendanceCheckDialogProps {
  mode: "in" | "out"
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AttendanceCheckDialog({
  mode,
  open,
  onOpenChange,
}: AttendanceCheckDialogProps) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"

  const { data: employees } = useEmployees()
  const checkIn = useCheckIn()
  const checkOut = useCheckOut()

  const [employeeId, setEmployeeId] = useState("")

  // تصفير الاختيار عند إعادة فتح الحوارية
  useEffect(() => {
    if (open) setEmployeeId("")
  }, [open])

  const selectableEmployees = useMemo(
    () =>
      (employees ?? []).filter(
        (e) => e.status === "active" || e.status === "probation",
      ),
    [employees],
  )

  const pending = checkIn.isPending || checkOut.isPending

  const confirm = () => {
    if (!employeeId) return
    const employeeName =
      employees?.find((e) => e.id === employeeId)?.full_name ?? "—"

    const onDone = (time: string | null) => {
      toast.success(
        mode === "in"
          ? t("attendance.checkedInToast")
          : t("attendance.checkedOutToast"),
        {
          description: `${employeeName} · ${time ?? ""}${
            isDemo ? ` — ${t("demo.toastSuffix")}` : ""
          }`,
        },
      )
      onOpenChange(false)
    }

    if (mode === "in") {
      checkIn.mutate(employeeId, {
        onSuccess: (record) => onDone(record.check_in),
        onError: (error) => toast.error(mapAttendanceError(t, error)),
      })
      return
    }

    checkOut.mutate(employeeId, {
      onSuccess: (record) => onDone(record.check_out),
      onError: (error) => toast.error(mapAttendanceError(t, error)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "in"
              ? t("attendance.inTitle")
              : t("attendance.outTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "in"
              ? t("attendance.inDescription")
              : t("attendance.outDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>{t("attendance.pickEmployee")}</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-full" data-testid="att-pick-employee">
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
        </div>

        <div className="flex justify-end gap-2">
          <Button
            onClick={confirm}
            disabled={!employeeId || pending}
            data-testid="att-pick-confirm"
          >
            {pending
              ? t("common.loading")
              : mode === "in"
                ? t("attendance.registerIn")
                : t("attendance.registerOut")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
