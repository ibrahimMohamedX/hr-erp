/**
 * سجل أقسام HR — المصدر الوحيد لحقيقة "ما هي الأقسام الموجودة وحالتها".
 * يُستخدم مستقبلًا لتوليد الـ Sidebar والروابط والصلاحيات الافتراضية.
 * التوثيق الكامل لكل قسم: docs/02-modules.md
 */

import type { HrModuleDefinition, HrModuleKey } from "@/types/hr-modules"

const moduleRoute = (key: HrModuleKey) => `/app/m/${key}`

export const HR_MODULES: readonly HrModuleDefinition[] = [
  {
    key: "employees",
    name: { ar: "الموظفين", en: "Employees" },
    description: {
      ar: "الملف الوظيفي الشامل لكل موظف: البيانات الشخصية، العقود، الوثائق، تاريخ الوظائف والعلاوات.",
      en: "Complete employee records: personal data, contracts, documents, job history and raises.",
    },
    icon: "Users",
    status: "ready",
    route: moduleRoute("employees"),
    dependsOn: ["departments"],
  },
  {
    key: "attendance",
    name: { ar: "الحضور والانصراف", en: "Attendance" },
    description: {
      ar: "تسجيل ومتابعة الحضور والغياب والتأخير والعمل الإضافي، مع قواعد تنظيمية قابلة للتخصيص لكل شركة.",
      en: "Track check-in/out, absence, lateness and overtime with per-company operational rules.",
    },
    icon: "CalendarClock",
    status: "ready",
    route: moduleRoute("attendance"),
    dependsOn: ["employees"],
  },
  {
    key: "leaves",
    name: { ar: "الإجازات", en: "Leaves" },
    description: {
      ar: "أنواع الإجازات وأرصدتها وقواعد استحقاق قابلة للتهيئة، مع دورة طلبات واعتماد كاملة وربط آمن بالحضور.",
      en: "Leave types, balances and configurable entitlements with a full request and approval flow, safely linked to attendance.",
    },
    icon: "Palmtree",
    status: "ready",
    route: moduleRoute("leaves"),
    dependsOn: ["employees", "attendance"],
  },
  {
    key: "payroll",
    name: { ar: "الرواتب", en: "Payroll" },
    description: {
      ar: "حساب الرواتب والعلاوات والاستقطاعات والبدلات، مع دورات رواتب قابلة للمراجعة والاعتماد قبل الصرف.",
      en: "Salary calculation, allowances, deductions and payroll cycles with review and approval flows.",
    },
    icon: "Banknote",
    status: "planned",
    route: moduleRoute("payroll"),
    dependsOn: ["employees", "attendance", "leaves"],
  },
  {
    key: "recruitment",
    name: { ar: "التوظيف", en: "Recruitment" },
    description: {
      ar: "إدارة الوظائف المفتوحة والمتقدمين ومراحل المقابلات حتى التعيين، مع تحويل المقبولين لموظفين.",
      en: "Manage job openings, applicants and interview stages until hiring, then convert to employees.",
    },
    icon: "UserPlus",
    status: "planned",
    route: moduleRoute("recruitment"),
    dependsOn: ["employees", "departments"],
  },
  {
    key: "departments",
    name: { ar: "الهيكل التنظيمي", en: "Departments" },
    description: {
      ar: "الأقسام والفروع والتسلسل الإداري ورؤساء الأقسام — العنصر التأسيسي الذي تعتمد عليه بقية الأقسام.",
      en: "Departments, branches and reporting lines — the foundational structure for all other modules.",
    },
    icon: "Network",
    status: "ready",
    route: moduleRoute("departments"),
    dependsOn: [],
  },
  {
    key: "performance",
    name: { ar: "تقييم الأداء", en: "Performance" },
    description: {
      ar: "دورات تقييم الأداء والأهداف ومؤشرات KPI ونتائج التقييم المؤثرة على العلاوات والترقيات.",
      en: "Performance review cycles, goals, KPIs and appraisal results feeding raises and promotions.",
    },
    icon: "Target",
    status: "planned",
    route: moduleRoute("performance"),
    dependsOn: ["employees", "departments"],
  },
  {
    key: "reports",
    name: { ar: "التقارير", en: "Reports" },
    description: {
      ar: "تقارير ولوحات مؤشرات عبر كل الأقسام: القوى العاملة، الغياب، تكلفة الرواتب، واتجاهات الأداء.",
      en: "Cross-module reports and dashboards: workforce, absence, payroll cost and performance trends.",
    },
    icon: "BarChart3",
    status: "planned",
    route: moduleRoute("reports"),
    dependsOn: ["employees", "attendance", "payroll"],
  },
  {
    key: "permissions",
    name: { ar: "الأدوار والصلاحيات", en: "Roles & Permissions" },
    description: {
      ar: "إدارة أدوار مستخدمي الشركة وقواعد الوصول والقواعد التشغيلية المخصصة — واجهة إدارية فوق الـ Rules Engine.",
      en: "Manage company user roles, access rules and custom operational rules — admin UI over the Rules Engine.",
    },
    icon: "ShieldCheck",
    status: "planned",
    route: moduleRoute("permissions"),
    dependsOn: ["employees"],
  },
] as const

/** إيجاد قسم بالمفتاح */
export function getHrModule(key: HrModuleKey): HrModuleDefinition {
  const found = HR_MODULES.find((m) => m.key === key)
  if (!found) {
    throw new Error(`Unknown HR module key: "${key}"`)
  }
  return found
}
