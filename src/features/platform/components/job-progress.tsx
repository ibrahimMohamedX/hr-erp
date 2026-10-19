/**
 * JobProgress — عرض مباشر لخطوات مهمة توفير (provisioning job).
 * كل خطوة بحالتها الحقيقية من الخادم/المحاكي — لا نجاح قبل تحققها.
 */

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  CheckCircle2,
  Circle,
  CircleX,
  Loader2,
} from "lucide-react"

import { useProvisioningJob } from "@/features/platform/data/queries"
import { cn } from "@/lib/utils"

const stepKeyLabels: Record<string, string> = {
  register_company: "provisioning.steps.register_company",
  create_project: "provisioning.steps.create_project",
  wait_healthy: "provisioning.steps.wait_healthy",
  fetch_api_keys: "provisioning.steps.fetch_api_keys",
  apply_schema: "provisioning.steps.apply_schema",
  create_admin: "provisioning.steps.create_admin",
  verify_connection: "provisioning.steps.verify_connection",
  verify_paused: "provisioning.steps.verify_paused",
  finalize: "provisioning.steps.finalize",
  pause_project: "provisioning.steps.pause_project",
  resume_project: "provisioning.steps.resume_project",
}

export function JobProgress({
  jobId,
  onSucceeded,
  onFailed,
}: {
  jobId: string | null
  onSucceeded?: () => void
  onFailed?: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: job } = useProvisioningJob(jobId)

  const status = job?.status ?? "queued"
  const succeeded = status === "succeeded"
  const failed = status === "failed"

  useEffect(() => {
    if (succeeded) onSucceeded?.()
    if (failed) onFailed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded, failed])

  // عند اكتمال المهمة (نجاحًا أو فشلًا): إعادة جلب بيانات المنصة —
  // بيانات الشركة تتغير بعد اكتمال الخطوات، بينما جُلب الكاش لحظة
  // بدء المهمة فقط (نفس المنطق ينطبق على الوضع الحقيقي عبر RLS).
  useEffect(() => {
    if (succeeded || failed) {
      void queryClient.invalidateQueries({ queryKey: ["platform"] })
    }
  }, [succeeded, failed, queryClient])

  if (!job) return null

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3">
        {job.steps.map((step, i) => (
          <div
            key={`${step.key}-${i}`}
            className={cn(
              "flex items-start gap-2.5 text-sm",
              step.state === "pending" && "text-muted-foreground/60",
              step.state === "failed" && "text-destructive",
            )}
          >
            <span className="mt-0.5 shrink-0">
              {step.state === "done" ? (
                <CheckCircle2 className="size-4 text-ok" />
              ) : step.state === "running" ? (
                <Loader2 className="size-4 animate-spin text-primary" />
              ) : step.state === "failed" ? (
                <CircleX className="size-4 text-destructive" />
              ) : (
                <Circle className="size-4" />
              )}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">
                {t(stepKeyLabels[step.key] ?? step.key)}
              </span>
              {step.detail ? (
                <span
                  className="truncate font-mono text-[11px] text-muted-foreground"
                  dir="ltr"
                >
                  {step.detail}
                </span>
              ) : null}
            </span>
          </div>
        ))}
      </div>

      {succeeded ? (
        <p className="flex items-center gap-2 text-sm text-ok">
          <CheckCircle2 className="size-4" />
          {t("provisioning.succeeded")}
        </p>
      ) : null}
      {failed ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <CircleX className="size-4" />
          {t("provisioning.failed")}
          {job.error ? (
            <span className="font-mono text-[11px]" dir="ltr">
              {job.error}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
