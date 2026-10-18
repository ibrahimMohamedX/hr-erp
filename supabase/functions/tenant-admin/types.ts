/**
 * أنواع مشتركة للـ Edge Function — مطابقة لـ src/types/platform.ts في الواجهة.
 */

export type ProvisioningAction =
  | "provision"
  | "reprovision"
  | "reconnect"
  | "verify"
  | "pause_infra"
  | "resume_infra"

export type ProvisioningStatus = "queued" | "running" | "succeeded" | "failed"

export type ProvisioningStepState = "pending" | "running" | "done" | "failed"

export interface ProvisioningStep {
  key: string
  state: ProvisioningStepState
  detail?: string
  at?: string
}

export interface ProvisioningJob {
  id: string
  company_id: string
  action: ProvisioningAction
  status: ProvisioningStatus
  steps: ProvisioningStep[]
  error: string | null
  started_at: string
  finished_at: string | null
}

export interface ActionResult {
  ok: boolean
  message?: string
  reason?: string
}

export interface ProvisionRequest {
  action: "provision"
  name: string
  slug: string
  admin_email: string
  plan: "starter" | "growth" | "enterprise"
  duration_months?: number
}

export interface CompanyActionRequest {
  action: "reprovision" | "reconnect" | "verify" | "pause_infra" | "resume_infra"
  company_id: string
}

export interface SubscriptionRequest {
  action: "subscription.update"
  company_id: string
  update:
    | "activate"
    | "suspend"
    | "renew"
    | "change_plan"
    | "set_duration"
  plan?: "starter" | "growth" | "enterprise" | "custom"
  duration_months?: number
}

export interface PollRequest {
  action: "poll"
  job_id: string
}

export type AdminRequest =
  | ProvisionRequest
  | CompanyActionRequest
  | SubscriptionRequest
  | PollRequest
