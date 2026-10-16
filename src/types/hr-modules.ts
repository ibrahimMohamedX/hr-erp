/**
 * تعريفات أقسام HR — مفاتيح الأقسام وأنواعها وسجلها.
 * سجل الأقسام الفعلي (بيانات كل قسم) في: src/config/modules.ts
 * التوثيق التفصيلي لكل قسم: docs/02-modules.md
 */

import type { LocalizedText } from "./common"

/** مفاتيح أقسام HR المعتمدة في النظام */
export const HR_MODULE_KEYS = [
  "employees",
  "attendance",
  "leaves",
  "payroll",
  "recruitment",
  "departments",
  "performance",
  "reports",
  "permissions",
] as const

export type HrModuleKey = (typeof HR_MODULE_KEYS)[number]

/** حالة تنفيذ القسم — كل الأقسام حاليًا "planned" */
export type HrModuleStatus = "planned" | "in_progress" | "ready"

/** تعريف قسم HR في السجل */
export interface HrModuleDefinition {
  key: HrModuleKey
  name: LocalizedText
  description: LocalizedText
  /** اسم أيقونة Lucide — تُستخدم عند بناء الـ Sidebar مستقبلًا */
  icon: string
  status: HrModuleStatus
  /** مسار القسم تحت /app/m/:moduleKey */
  route: string
  /** أقسام يعتمد عليها هذا القسم وظيفيًا */
  dependsOn: HrModuleKey[]
}

/** حارس نوعي: هل السلسلة مفتاح قسم معتمد؟ */
export function isHrModuleKey(value: string): value is HrModuleKey {
  return (HR_MODULE_KEYS as readonly string[]).includes(value)
}
