/**
 * أساس نظام Rules & Permissions — الأنواع والعقود فقط في هذه المرحلة.
 * التنفيذ الكامل للـ Rules Engine (شروط ديناميكية، تقييم متقدم) في مرحلة لاحقة.
 * المرجع التوثيقي الكامل: docs/04-rbac-rules-engine.md
 *
 * ⚠️ مبدأ أمني ثابت: أي فحص صلاحيات في الواجهة هو تحسين تجربة استخدام فقط.
 *    الحماية الفعلية للبيانات تكون حصريًا عبر Supabase RLS والتحقق من جهة الخادم.
 */

import type { JsonValue, UUID } from "./common"
import type { TenantId } from "./tenant"
import type { HrModuleKey } from "./hr-modules"
import type { AppRole, UserId } from "./user"

/** الأفعال المعرَّفة في كتالوج الصلاحيات */
export const RBAC_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "approve",
  "export",
  "manage",
  "administer",
] as const

export type RbacAction = (typeof RBAC_ACTIONS)[number]

/** موارد أقسام HR — module:employees ... إلخ */
export type RbacModuleResource = `module:${HrModuleKey}`

/** موارد إدارة المنصة — لمنطقة Platform Super Admin فقط */
export type RbacPlatformResource =
  | `platform:${"tenants" | "subscriptions" | "system" | "users"}`

/** موارد إعدادات الشركة — للأدوار الإدارية داخل الشركة */
export type RbacCompanyResource = `company:${"settings" | "roles" | "rules"}`

export type RbacResource =
  | RbacModuleResource
  | RbacPlatformResource
  | RbacCompanyResource

/** الصيغة القياسية للصلاحية: "resource:action" — مثل module:leaves:approve */
export type Permission = `${RbacResource}:${RbacAction}`

/** نتيجة القرار ومصدره — للـ observability والتصحيح مستقبلًا */
export type RbacDecisionSource =
  | "user_rule"
  | "role_rule"
  | "role_default"
  | "default_deny"

export interface RbacDecision {
  allowed: boolean
  source: RbacDecisionSource
  matchedRuleId?: UUID
}

/** تأثير القاعدة: السماح أو المنع */
export type RbacRuleEffect = "allow" | "deny"

/** نطاق تطبيق القاعدة */
export type RbacRuleScope = "platform" | "tenant" | "role" | "user"

/** الأساس المشترك لقواعد الوصول */
export interface RbacRuleBase {
  id: UUID
  /** null = قاعدة عامة على مستوى المنصة (نادر) */
  tenant_id: TenantId | null
  effect: RbacRuleEffect
  enabled: boolean
  /** الأعلى أولًا عند تعارض القواعد */
  priority: number
}

/** قاعدة موجهة لدور: "مندوب HR يقدر يعتمد الإجازات في الشركة س" */
export interface RbacRoleRule extends RbacRuleBase {
  scope: "role"
  role: AppRole
  resource: RbacResource
  /** "*" = كل الأفعال على المورد */
  action: RbacAction | "*"
}

/** قاعدة موجهة لمستخدم بعينه: "المستخدم ص يقدر يشمل الرواتب" */
export interface RbacUserRule extends RbacRuleBase {
  scope: "user"
  user_id: UserId
  resource: RbacResource
  action: RbacAction | "*"
}

export type RbacAccessRule = RbacRoleRule | RbacUserRule

/**
 * القواعد التشغيلية — إعدادات عمل قابلة للتخصيص لكل شركة،
 * مثل الحد الأقصى لرصيد الإجازات أو تفعيل العمل الإضافي.
 * المفاتيح تكون namespaces مثل: "leaves.max_annual_balance"
 */
export type OperationalRuleKey = string

export interface OperationalRule {
  id: UUID
  tenant_id: TenantId
  key: OperationalRuleKey
  value: JsonValue
  enabled: boolean
  created_at: string
  updated_at: string
}

/** سياق تقييم الصلاحيات — كل ما يحتاجه الـ Evaluator */
export interface RbacContext {
  userId: UserId
  role: AppRole
  tenantId: TenantId | null
}

/**
 * عقد الـ Rules Engine — التنفيذ الكامل في مرحلة لاحقة.
 * الأساس الحالي: src/lib/rbac/evaluate.ts (تقييم أساسي هيكلي).
 */
export interface RulesEngine {
  can(
    ctx: RbacContext,
    permission: Permission,
    rules?: readonly RbacAccessRule[],
  ): RbacDecision
  listEffectivePermissions(
    ctx: RbacContext,
    rules?: readonly RbacAccessRule[],
  ): Permission[]
}
