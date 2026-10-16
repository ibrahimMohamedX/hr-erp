/**
 * مقيّم الصلاحيات — أساس الـ Rules Engine الهيكلي.
 * يحدد ترتيب التقييم: قواعد المستخدم ← قواعد الدور ← الافتراضات ← منع افتراضي.
 *
 * ⚠️ مبدأ أمني: نتيجة التقييم هنا تجربة استخدام فقط (إظهار/إخفاء وتوجيه).
 *    الحماية الفعلية للبيانات تكون حصريًا عبر Supabase RLS والتحقق من جهة الخادم.
 *
 * التوسعات المستقبلية (موثقة في docs/04-rbac-rules-engine.md):
 *    شروط ديناميكية (conditions DSL)، قواعد حسب company_role، تقييم بعمليات جانبية.
 */

import type {
  Permission,
  RbacAccessRule,
  RbacContext,
  RbacDecision,
} from "@/types/rbac"

import {
  ROLE_PERMISSION_DEFAULTS,
  matchesPermission,
  type PermissionPattern,
} from "@/lib/rbac/permissions"

/** هل القاعدة مطبقة على سياق الشركة الحالي؟ (null = قاعدة عامة على المنصة) */
function isRuleInTenantScope(
  rule: RbacAccessRule,
  ctx: RbacContext,
): boolean {
  return rule.tenant_id === null || rule.tenant_id === ctx.tenantId
}

/** مطابقة مورد/فعل القاعدة مع الصلاحية المطلوبة */
function ruleMatchesPermission(
  rule: RbacAccessRule,
  permission: Permission,
): boolean {
  const [ruleScope, ruleTarget] = rule.resource.split(":")
  const [permScope, permTarget, permAction] = permission.split(":")
  if (ruleScope !== permScope || ruleTarget !== permTarget) return false
  return rule.action === "*" || rule.action === permAction
}

const byPriorityDesc = (a: RbacAccessRule, b: RbacAccessRule) =>
  b.priority - a.priority

/**
 * التقييم الأساسي — أول قاعدة مطابقة تحسم القرار (deny و allow بنفس القوة)،
 * وإلا تُطبق الافتراضات حسب الدور، وإلا المنع الافتراضي.
 */
export function evaluateAccess(
  ctx: RbacContext,
  permission: Permission,
  rules: readonly RbacAccessRule[] = [],
): RbacDecision {
  const activeRules = rules.filter(
    (rule) => rule.enabled && isRuleInTenantScope(rule, ctx),
  )

  // 1) قواعد موجهة للمستخدم نفسه — أعلى أولوية
  const userRules = activeRules
    .filter(
      (rule): rule is Extract<RbacAccessRule, { scope: "user" }> =>
        rule.scope === "user" && rule.user_id === ctx.userId,
    )
    .sort(byPriorityDesc)

  for (const rule of userRules) {
    if (ruleMatchesPermission(rule, permission)) {
      return {
        allowed: rule.effect === "allow",
        source: "user_rule",
        matchedRuleId: rule.id,
      }
    }
  }

  // 2) قواعد موجهة لدور المستخدم داخل شركته
  const roleRules = activeRules
    .filter(
      (rule): rule is Extract<RbacAccessRule, { scope: "role" }> =>
        rule.scope === "role" && rule.role === ctx.role,
    )
    .sort(byPriorityDesc)

  for (const rule of roleRules) {
    if (ruleMatchesPermission(rule, permission)) {
      return {
        allowed: rule.effect === "allow",
        source: "role_rule",
        matchedRuleId: rule.id,
      }
    }
  }

  // 3) الافتراضات حسب الدور
  for (const pattern of ROLE_PERMISSION_DEFAULTS[ctx.role] as readonly PermissionPattern[]) {
    if (matchesPermission(pattern, permission)) {
      return { allowed: true, source: "role_default" }
    }
  }

  // 4) منع افتراضي
  return { allowed: false, source: "default_deny" }
}

/** فحص سريع: هل السياق يملك الصلاحية؟ */
export function canAccess(
  ctx: RbacContext,
  permission: Permission,
  rules?: readonly RbacAccessRule[],
): boolean {
  return evaluateAccess(ctx, permission, rules).allowed
}
