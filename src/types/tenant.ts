/**
 * أنواع الشركات (Tenants) والاشتراكات — وحدة العزل الأساسية في النظام.
 * كل بيانات HR (موظفين، حضور، رواتب...) تنتمي لـ tenant_id واحد.
 * المرجع التوثيقي: docs/03-tenancy-and-users.md
 */

import type {
  BaseAuditableEntity,
  EntityStatus,
  ISODate,
  ISODateTime,
  LocalizedText,
  UUID,
} from "./common"

export type TenantId = UUID

/** معرف نصي فريد للشركة (slug) — للاستخدام في الروابط مستقبلًا */
export type TenantSlug = string

/** حالة اتصال الشركة — لعرضها في Dashboard المنصة مستقبلًا */
export type TenantConnectionState = "connected" | "disconnected" | "degraded"

/** حالة المشروع كما ترد من Supabase Management API */
export type InfraProjectState =
  | "inactive"
  | "active"
  | "paused"
  | "paused_for_upgrade"
  | "restoring"
  | "unknown"

/** حالة الاتصال بالمشروع — تُحدّث فقط بعد تحقق فعلي (REST health) */
export type ProjectConnectionState = "connected" | "degraded" | "disconnected"

/**
 * معلومات مشروع Supabase المستقل للشركة — بيانات عميلية آمنة فقط.
 * ⚠️ لا يُخزَّن هنا service_role key إطلاقًا؛ يُسترجع من
 *    Management API عند الحاجة على الخادم فقط.
 */
export interface TenantProject {
  /** ref المشروع لدى Supabase */
  ref: string
  /** https://{ref}.supabase.co — آمن للعميل */
  url: string
  region: string
  infra_state: InfraProjectState
  connection_state: ProjectConnectionState
  /** هل anon key محفوظ وجاهز للتسليم للواجهة؟ (القيمة نفسها لا) */
  anon_key_set: boolean
  last_verified_at: string | null
  created_at: string
}

/**
 * خطط الاشتراك — هيكل فقط في هذه المرحلة.
 * نظام الاشتراكات الفعلي (خطط، حدود، فوترة) يُنفَّذ في مرحلة لاحقة.
 */
export type SubscriptionPlanKey = "starter" | "growth" | "enterprise" | "custom"

/** دورة حياة الاشتراك الكاملة (future) */
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "expired"

export interface TenantSubscription extends BaseAuditableEntity {
  tenant_id: TenantId
  plan: SubscriptionPlanKey
  status: SubscriptionStatus
  /** عدد المقاعد المرخصة — null = غير محدد */
  seats: number | null
  current_period_start: ISODate
  current_period_end: ISODate
}

/** الشركة / المستأجر */
export interface Tenant {
  id: TenantId
  slug: TenantSlug
  name: string
  display_name?: LocalizedText | null
  logo_url?: string | null
  status: EntityStatus
  connection_state: TenantConnectionState
  /** مشروع Supabase المستقل — null قبل اكتمال التوفير أو عند فشله */
  project: TenantProject | null
  subscription: TenantSubscription | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

/** نسخة مختصرة من الشركة — للاستخدام داخل الـ Session والأدوار */
export type TenantLite = Pick<
  Tenant,
  "id" | "slug" | "name" | "status" | "connection_state"
>

/** مؤشرات استخدام الشركة — لعرضها في Dashboard المنصة مستقبلًا */
export interface TenantUsageSnapshot {
  tenant_id: TenantId
  active_users: number
  employee_count: number
  storage_used_mb: number
  last_activity_at: ISODateTime | null
}

/** الشركة كما تُعرض في Dashboard الـ Platform Super Admin */
export interface PlatformTenantOverview extends Tenant {
  usage: TenantUsageSnapshot | null
}

/** البيانات المطلوبة لإنشاء شركة جديدة من منطقة المنصة (future) */
export interface CreateTenantInput {
  name: string
  slug: TenantSlug
  plan: SubscriptionPlanKey
  admin_email: string
}
