/**
 * أنواع المستخدمين والأدوار الأساسية الثلاثة.
 * الفصل المعماري بين منطقة المنصة ومنطقة الشركة يبدأ من هنا.
 * المرجع التوثيقي: docs/03-tenancy-and-users.md
 */

import type { BaseAuditableEntity, EntityStatus, UUID } from "./common"
import type { TenantId, TenantLite } from "./tenant"

export type UserId = UUID

/**
 * الأدوار الأساسية الثلاثة للنظام:
 * - platform_super_admin: إدارة المنصة بالكامل (شركات، اشتراكات، نظام) — بدون tenant
 * - company_admin: إدارة شركته فقط (tenant واحد)
 * - company_user: صلاحيات حسب الدور الداخلي والقواعد المخصصة لشركته
 */
export const APP_ROLES = [
  "platform_super_admin",
  "company_admin",
  "company_user",
] as const

export type AppRole = (typeof APP_ROLES)[number]

/** دور داخل الشركة — يُستخدم لصياغة قواعد دقيقة (future) */
export const COMPANY_INTERNAL_ROLES = [
  "hr_manager",
  "hr_specialist",
  "team_lead",
  "employee",
] as const

export type CompanyInternalRole = (typeof COMPANY_INTERNAL_ROLES)[number]

/** مستخدم المصادقة كما يأتي من Supabase Auth */
export interface AppAuthUser {
  id: UserId
  email: string
}

/**
 * بروفايل المستخدم التطبيقي — صف في جدول profiles (future).
 * tenant_id = null يعني مستخدم منصة (Platform Super Admin).
 */
export interface UserProfile extends BaseAuditableEntity {
  user_id: UserId
  tenant_id: TenantId | null
  full_name: string
  role: AppRole
  /** دور داخلي بالشركة — يُستخدم في قواعد RBAC المخصصة (future) */
  company_role: CompanyInternalRole | null
  avatar_url: string | null
  status: EntityStatus
}

/** الجلسة المجمعة: مستخدم المصادقة + البروفايل + الشركة النشطة */
export interface AppSession {
  user: AppAuthUser
  profile: UserProfile
  /** null لمستخدم المنصة — الشركة النشطة لمستخدمي الشركات */
  tenant: TenantLite | null
}

export type SessionStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
