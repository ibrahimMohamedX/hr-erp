/**
 * LeaveDecisionDialog — حوارية قرار المدير على طلب معلق:
 * اعتماد (تأكيد مباشر) أو رفض (سبب إلزامي).
 *
 * يثبّت القرار (decided_at/decided_by) في طبقة البيانات — الواجهة
 * تعرض التاريخ في التذييل فقط. التعديل بعد القرار غير متاح أصلًا.
 */

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  useApproveLeaveRequest,
  useRejectLeaveRequest,
} from "@/features/company/data/queries"
import { mapLeaveError } from "./leave-request-form"
import { appEnv } from "@/config/env"
import type { LeaveRequest } from "@/types"

export interface LeaveDecisionDialogProps {
  request: LeaveRequest | null
  /** approve: تأكيد مباشر · reject: سبب إلزامي */
  mode: "approve" | "reject"
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeaveDecisionDialog({
  request,
  mode,
  open,
  onOpenChange,
}: LeaveDecisionDialogProps) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"

  const approve = useApproveLeaveRequest()
  const reject = useRejectLeaveRequest()
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)

  // تفريغ السبب عند كل فتح
  useEffect(() => {
    if (open) {
      setReason("")
      setReasonError(null)
    }
  }, [open])

  const isPending = approve.isPending || reject.isPending

  const submit = () => {
    if (!request) return
    if (mode === "reject") {
      const trimmed = reason.trim()
      if (!trimmed) {
        setReasonError(t("validation.rejectReasonRequired"))
        return
      }
      reject.mutate(
        { id: request.id, reason: trimmed },
        {
          onSuccess: (updated) => {
            toast.success(t("leaves.rejectedToast"), {
              description: `${request.employee_name} · ${request.leave_type_name}${
                updated.decided_at
                  ? ` — ${updated.decided_at.slice(0, 10)}`
                  : ""
              }${isDemo ? ` · ${t("demo.toastSuffix")}` : ""}`,
            })
            onOpenChange(false)
          },
          onError: (error) => toast.error(mapLeaveError(t, error)),
        },
      )
      return
    }
    approve.mutate(request.id, {
      onSuccess: (updated) => {
        toast.success(t("leaves.approvedToast"), {
          description: `${request.employee_name} · ${request.leave_type_name}${
            updated.decided_at ? ` — ${updated.decided_at.slice(0, 10)}` : ""
          }${isDemo ? ` · ${t("demo.toastSuffix")}` : ""}`,
        })
        onOpenChange(false)
      },
      onError: (error) => toast.error(mapLeaveError(t, error)),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "approve"
              ? t("leaves.approveTitle")
              : t("leaves.rejectTitle")}
          </DialogTitle>
          <DialogDescription>
            {mode === "approve"
              ? t("leaves.approveDescription")
              : t("leaves.rejectDescription")}
          </DialogDescription>
        </DialogHeader>

        {request ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
            {request.employee_name} · {request.leave_type_name} ·{" "}
            <span className="font-latin text-label" dir="ltr">
              {request.start_date} → {request.end_date} ({request.days})
            </span>
          </p>
        ) : null}

        {mode === "reject" ? (
          <div className="space-y-2">
            <Label htmlFor="lv-reject-reason">{t("leaves.rejectionReason")}</Label>
            <Textarea
              id="lv-reject-reason"
              rows={3}
              placeholder={t("leaves.rejectionReasonPlaceholder")}
              data-testid="lv-reject-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                setReasonError(null)
              }}
            />
            {reasonError ? (
              <p className="text-sm text-destructive">{reasonError}</p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={mode === "reject" ? "destructive" : "default"}
            disabled={isPending}
            data-testid="lv-decision-confirm"
            onClick={submit}
          >
            {isPending
              ? t("common.loading")
              : mode === "approve"
                ? t("leaves.approveAction")
                : t("leaves.rejectAction")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
