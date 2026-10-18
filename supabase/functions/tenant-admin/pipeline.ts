/**
 * خط توفير المشاريع — State Machine تُقدَّم خطوة لكل استدعاء (poll).
 *
 * التصميم: Edge Function بلا حالة مستمرة — الحالة كلها في provisioning_jobs
 * (steps jsonb). كل استدعاء poll ينفذ "الخطوة التالية" فقط، فلا تتجاوز أي
 * دالة حدود التنفيذ مهما طالت دورة إنشاء المشروع.
 *
 * ⚠️ مبدأ صارم: لا خطوة تنتقل لـ done قبل التحقق من نتيجتها.
 */

import type { ProvisioningJob, ProvisioningStep } from "./types.ts"

export interface JobRecord extends ProvisioningJob {
  /** بيانات مرفقة بين الخطوات (ref، keys مؤقتة…) — لا تُرسل للعميل */
  scratch: Record<string, string | undefined>
}

export function stepIndex(job: JobRecord): number {
  return job.steps.findIndex((s) => s.state !== "done")
}

export function markRunning(job: JobRecord, key: string): void {
  const open = job.steps.find((s) => s.state === "pending" && s.key === key)
  if (open) {
    open.state = "running"
    open.at = new Date().toISOString()
  }
}

export function markDone(job: JobRecord, key: string, detail?: string): void {
  const step = job.steps.find((s) => s.key === key)
  if (step) {
    step.state = "done"
    step.at = new Date().toISOString()
    if (detail) step.detail = detail
  }
}

export function markFailed(
  job: JobRecord,
  key: string,
  error: string,
): void {
  const step = job.steps.find((s) => s.key === key)
  if (step) {
    step.state = "failed"
    step.detail = error.slice(0, 500)
    step.at = new Date().toISOString()
  }
  job.status = "failed"
  job.error = error.slice(0, 500)
  job.finished_at = new Date().toISOString()
}

/** القوالب الأولية للمهام — نفس الخطوات المعروضة في الواجهة */
export function initialSteps(action: string): ProvisioningStep[] {
  const templates: Record<string, string[]> = {
    provision: [
      "register_company",
      "create_project",
      "wait_healthy",
      "fetch_api_keys",
      "verify_connection",
      "finalize",
    ],
    reprovision: [
      "create_project",
      "wait_healthy",
      "fetch_api_keys",
      "verify_connection",
      "finalize",
    ],
    reconnect: ["fetch_api_keys", "verify_connection", "finalize"],
    verify: ["verify_connection", "finalize"],
    pause_infra: ["pause_project", "verify_connection"],
    resume_infra: ["resume_project", "verify_connection", "finalize"],
  }
  const keys = templates[action] ?? []
  return keys.map((key) => ({ key, state: "pending" as const }))
}
