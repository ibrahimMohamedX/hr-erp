/**
 * خط توفير المشاريع — State Machine تُقدَّم خطوة لكل استدعاء (poll).
 *
 * التصميم: Edge Function بلا حالة مستمرة — الحالة كلها في provisioning_jobs
 * (steps jsonb). كل استدعاء poll ينفذ "الخطوة التالية" فقط، فلا تتجاوز أي
 * دالة حدود التنفيذ مهما طالت دورة إنشاء المشروع.
 *
 * ⚠️ مبدأ صارم: لا خطوة تنتقل لـ done قبل التحقق من نتيجتها.
 * ⚠️ عدّاد المحاولات (tries) يعيش داخل الخطوة نفسها — يُحفظ مع steps في
 *    قاعدة البيانات فلا يتصفر بين استدعاءات الـ poll.
 */

import type { ProvisioningJob, ProvisioningStep } from "./types.ts"

export interface JobRecord extends ProvisioningJob {
  /** بيانات مرفقة داخل الاستدعاء الواحد فقط — لا تعيش بين الاستدعاءات */
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

/** زيادة عدّاد محاولات خطوة (يُحفظ مع steps في قاعدة البيانات) */
export function bumpTries(step: ProvisioningStep): number {
  step.tries = (step.tries ?? 0) + 1
  step.at = new Date().toISOString()
  return step.tries
}

/** الخطوة المفتوحة الحالية — أول running أو pending */
export function openStep(job: JobRecord): ProvisioningStep | undefined {
  return job.steps.find((s) => s.state === "running" || s.state === "pending")
}

/**
 * القوالب الأولية للمهام — نفس الخطوات المعروضة في الواجهة.
 * الترتيب الحرج: apply_schema قبل create_admin (الدعوة تحتاج جدول profiles)،
 * وcreate_admin قبل verify_connection (التحقق النهائي بعد اكتمال التجهيز).
 */
export function initialSteps(action: string): ProvisioningStep[] {
  const templates: Record<string, string[]> = {
    provision: [
      "register_company",
      "create_project",
      "wait_healthy",
      "fetch_api_keys",
      "apply_schema",
      "create_admin",
      "verify_connection",
      "finalize",
    ],
    reprovision: [
      "create_project",
      "wait_healthy",
      "fetch_api_keys",
      "apply_schema",
      "create_admin",
      "verify_connection",
      "finalize",
    ],
    reconnect: ["fetch_api_keys", "verify_connection", "finalize"],
    verify: ["verify_connection", "finalize"],
    // pause: يتحقق من حالة "موقوف" — لا من نجاح الاتصال
    pause_infra: ["pause_project", "verify_paused", "finalize"],
    // resume: restore قد يستغرق دقائق — wait_healthy يتحمل الانتظار
    resume_infra: ["resume_project", "wait_healthy", "verify_connection", "finalize"],
  }
  const keys = templates[action] ?? []
  return keys.map((key) => ({ key, state: "pending" as const }))
}
