/**
 * Control Plane Platform — نموذج "مشروع Supabase مستقل لكل شركة".
 *
 * المعمارية:
 *   ┌─ Platform Project (Control Plane) ─────────────────────┐
 *   │  platform_users · companies · subscriptions           │
 *   │  provisioning_jobs  (+ Edge Function tenant-admin)    │
 *   │  ⚠️ مفاتيح الإدارة: أسرار على الخادم فقط             │
 *   └──────────────┬─────────────────────────────────────────┘
 *                  │ Management API (server-only)
 *   ┌──────────────▼──────────────┐   ┌──────────────────────┐
 *   │ Tenant Project: شركة (أ)   │   │ Tenant Project: ب   │ …
 *   │ بياناتها ومستخدموها فقط    │   │ …عزل كامل…          │
 *   └─────────────────────────────┘   └──────────────────────┘
 *
 * فصل صريح: اشتراك العميل في منتجنا (subscriptions) ≠
 * اشتراك/حالة البنية التحتية لدى Supabase (infra).
 */

import type { ISODateTime, UUID } from "./common"
import type { TenantId } from "./tenant"

// ─── TenantProject ── معرف في tenant.ts (معلومات مشروع الشركة المستقل) ────

// ─── Provisioning Jobs — لا نجاح بدون تحقق ────────────────────────────────

export type ProvisioningAction =
  | "provision" // إنشاء مشروع جديد لشركة
  | "reprovision" // إعادة توفير (مشروع جديد بدلًا عن الفاشل)
  | "reconnect" // استعادة اتصال: re-fetch keys + تحقق
  | "verify" // فحص اتصال فقط
  | "pause_infra" // إيقاف البنية (Supabase pause) — منفصل عن الاشتراك
  | "resume_infra" // تشغيل البنية

export type ProvisioningStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"

export type ProvisioningStepState = "pending" | "running" | "done" | "failed"

/** خطوة واحدة في خط التوفير — كل خطوة تُتحقق من نتيجتها قبل التالية */
export interface ProvisioningStep {
  key: string
  state: ProvisioningStepState
  /** تفاصيل التقنية للسجل — مثل ref أو مدة الانتظار */
  detail?: string
  at?: ISODateTime
}

export interface ProvisioningJob {
  id: UUID
  company_id: TenantId
  action: ProvisioningAction
  status: ProvisioningStatus
  steps: ProvisioningStep[]
  error: string | null
  started_at: ISODateTime
  finished_at: ISODateTime | null
}

/** مدخلات توفير شركة جديدة (من لوحة المنصة) */
export interface ProvisionCompanyInput {
  name: string
  slug: string
  admin_email: string
  plan: "starter" | "growth" | "enterprise"
  /** مدة الاشتراك بالأشهر — الافتراضي من الخادم */
  duration_months?: number
}

// ─── الاشتراك (منتجنا) — منفصل عن البنية التحتية ──────────────────────────

export type SubscriptionAction =
  | "activate"
  | "suspend"
  | "renew"
  | "change_plan"
  | "set_duration"

export interface SubscriptionUpdateInput {
  company_id: TenantId
  action: SubscriptionAction
  plan?: "starter" | "growth" | "enterprise" | "custom"
  /** للتجديد أو تحديد المدة بالأشهر */
  duration_months?: number
}

/** نتيجة أي عملية إدارية — تؤكد ما حدث فعليًا على الخادم */
export interface ActionResult {
  ok: boolean
  /** رسالة قصيرة للعرض في الواجهة */
  message?: string
  /** السبب عند الفشل — مثل "project_unhealthy" */
  reason?: string
}

// ─── حالة اتصال الواجهة بالـ Control Plane ───────────────────────────────

/**
 * هل الواجهة مربوطة بالـ Backend الحقيقي أم تعمل بوضع تجريبي؟
 * demo: بيانات mock محاكية موسومة (لا اتصال فعلي).
 */
export type PlatformBackendMode = "live" | "demo"
