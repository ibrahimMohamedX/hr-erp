/**
 * كتالوج الصلاحيات والافتراضات حسب الدور — جزء أساس الـ Rules Engine.
 * المرجع التوثيقي: docs/04-rbac-rules-engine.md
 *
 * صيغة الصلاحية القياسية (3 مقاطع):  scope:target:action
 *   - module:employees:view · platform:tenants:manage · company:rules:manage
 * الأنماط (Patterns) تدعم "*" كمقطع wildcard:
 *   - module:*:view · platform:*:* · company:settings:*
 */

import type { AppRole } from "@/types/user"
import type { RbacAction, RbacResource, Permission } from "@/types/rbac"

export type PermissionPattern = Permission | `${string}:*` | `${string}:*:*` | "*"

/** بناء صلاحية مطابقة الأنواع من مورد + فعل */
export function permission<R extends RbacResource>(
  resource: R,
  action: RbacAction,
): Permission {
  return `${resource}:${action}` as Permission
}

/** مطابقة نمط بصلاحية — "*" wildcard على مستوى المقطع */
export function matchesPermission(
  pattern: PermissionPattern,
  permission: Permission,
): boolean {
  if (pattern === "*") return true
  const patternParts = pattern.split(":")
  const permissionParts = permission.split(":")
  if (patternParts.length !== permissionParts.length) return false
  return patternParts.every(
    (part, i) => part === "*" || part === permissionParts[i],
  )
}

/**
 * الافتراضات حسب الدور — نقطة البداية قبل تطبيق أي قواعد مخصصة.
 * الشركات تقدر تضيف/تمنع فوقها بقواعد scope: role / user لاحقًا.
 *
 * ملاحظات تصميمية:
 * - platform_super_admin: موارد المنصة فقط — لا يملك أي وصول لبيانات
 *   أقسام HR الخاصة بالشركات (العزل مفروض أيضًا عبر RLS).
 * - company_admin: كل أقسام شركته وإعداداتها.
 * - company_user: مجموعة بداية محدودة — تُخصص بقواعد كل شركة.
 */
export const ROLE_PERMISSION_DEFAULTS: Record<
  AppRole,
  readonly PermissionPattern[]
> = {
  platform_super_admin: ["platform:*:*"],
  company_admin: ["module:*:*", "company:*:*"],
  company_user: [
    "module:employees:view",
    "module:attendance:view",
    "module:attendance:create",
    "module:leaves:view",
    "module:leaves:create",
    "module:performance:view",
    "module:reports:view",
  ],
}

/**
 * أمثلة مفاتيح القواعد التشغيلية — توثيقية فقط،
 * التنفيذ الفعلي (قراءة/تقييم) في مرحلة لاحقة.
 */
export const OPERATIONAL_RULE_EXAMPLES = {
  "leaves.max_annual_balance": 21,
  "leaves.carryover.enabled": true,
  "attendance.overtime.enabled": true,
  "attendance.grace_period_minutes": 10,
  "payroll.currency": "EGP",
} as const
