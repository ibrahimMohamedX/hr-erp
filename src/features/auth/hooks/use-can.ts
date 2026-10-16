/**
 * useCan — Hook فحص الصلاحيات عبر أساس الـ Rules Engine.
 * يدمج سياق الجلسة الحالي (الدور/المستخدم/الشركة) مع القواعد المتاحة.
 *
 * ⚠️ النتيجة لتحسين تجربة الواجهة فقط (إظهار/إخفاء) —
 *    الحماية الفعلية عبر Supabase RLS والتحقق من جهة الخادم.
 *
 * TODO (future): جلب قواعد الشركة من الخادم وتخزينها في TanStack Query
 *    وتمريرها هنا تلقائيًا بدل الاعتماد على معامل rules اليدوي.
 */

import { useMemo } from "react"

import { evaluateAccess } from "@/lib/rbac/evaluate"
import type { Permission, RbacAccessRule, RbacDecision } from "@/types"

import { useSession } from "../session"

export function useCan(
  permission: Permission,
  rules?: readonly RbacAccessRule[],
): RbacDecision {
  const { rbacContext } = useSession()

  return useMemo(() => {
    if (!rbacContext) {
      return { allowed: false, source: "default_deny" }
    }
    return evaluateAccess(rbacContext, permission, rules)
  }, [rbacContext, permission, rules])
}
