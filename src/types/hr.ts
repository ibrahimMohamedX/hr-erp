/**
 * أنواع أقسام HR الفعلية — الموظفين والإدارات والمناصب والحضور
 * والإجازات (أنواعها وطلباتها داخل CompanyApi).
 * كل جدول مستقبلي يحمل tenant_id + RLS (docs/05).
 *
 * ملاحظة معمارية (DB-per-tenant): في الوضع live لا يوجد عمود tenant_id
 * في جداول مشروع الشركة — العزل فيزيائي. القيمة "live" تُضبط في
 * الـ mapper لعرض فقط (الأنواع تتطلب tenant_id).
 */

import type { BaseAuditableEntity, ISODate, ISODateTime, TimeClock, UUID } from "./common"
import type { TenantId } from "./tenant"

/** حالة الموظف في دورة حياته الوظيفية */
export type EmployeeStatus = "active" | "probation" | "suspended" | "terminated"

/** الموظف — ملف الوظيفة الأساسي (قسم Employees) */
export interface Employee extends BaseAuditableEntity {
  tenant_id: TenantId
  /** كود داخلي موحد للموظف — EMP-001 */
  employee_code: string
  full_name: string
  email: string
  phone: string | null
  job_title: string
  department_id: UUID
  /** المسمى الوظيفي (Position) — null = غير مسند */
  position_id: UUID | null
  hire_date: ISODate
  /** الراتب الأساسي الشهري — null = غير مسجل */
  salary: number | null
  status: EmployeeStatus
}

/** الإدارة/القسم — الهيكل التنظيمي (قسم Departments) */
export interface Department extends BaseAuditableEntity {
  tenant_id: TenantId
  name: string
  /** كود قصير — ENG, HR, SALES */
  code: string
  manager_name: string | null
}

/** المسمى الوظيفي (Position) — دليل المسميات لكل إدارة */
export interface Position extends BaseAuditableEntity {
  tenant_id: TenantId
  /** كود قصير — SE1, SE2, HR-SPEC */
  code: string
  title: string
  /** null = منصب عام غير مرتبط بإدارة محددة */
  department_id: UUID | null
}

/** حالة سجل الحضور اليومي */
export type AttendanceStatus = "present" | "late" | "absent" | "on_leave"

/** سجل حضور يوم واحد لموظف (قسم Attendance) */
export interface AttendanceRecord {
  id: UUID
  tenant_id: TenantId
  employee_id: UUID
  employee_name: string
  department_id: UUID
  date: ISODate
  check_in: TimeClock | null
  check_out: TimeClock | null
  status: AttendanceStatus
  /** ملاحظة حرة على السجل — null = بلا ملاحظة */
  note: string | null
}

/**
 * إعدادات قواعد الحضور لكل شركة — تُقرأ/تُحدَّث عبر CompanyApi
 * (مصدر الحسابات النقي: features/company/lib/attendance-rules.ts)
 */
export interface AttendanceSettings {
  tenant_id: TenantId
  /** بداية الدوام الرسمي — "09:00" */
  work_start: TimeClock
  /** نهاية الدوام الرسمي — "17:00" */
  work_end: TimeClock
  /** دقائق السماح بعد بداية الدوام قبل احتساب التأخير */
  late_grace_minutes: number
  /** أيام العمل الأسبوعية باصطلاح getDay: 0=الأحد … 6=السبت */
  work_days: number[]
  /** تفعيل احتساب العمل الإضافي (عرض فقط في هذه النسخة) */
  overtime_enabled: boolean
}

// ─── الإجازات ────────────────────────────────────────────────────────────────

/**
 * تعريف نوع إجازة (hr_leave_types) — دليل أنواع الإجازات لكل شركة.
 * annual_days = null يعني نوعًا بلا حد سنوي (رصيد غير محدود).
 */
export interface LeaveTypeDefinition {
  id: UUID
  tenant_id: TenantId
  name: string
  description: string | null
  /** الحد السنوي بأيام العمل — null = بلا حد */
  annual_days: number | null
  is_paid: boolean
  is_active: boolean
  created_at: ISODateTime
}

/** حالة طلب الإجازة — الإلغاء تغيير حالة (لا DELETE على الطلبات إطلاقًا) */
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled"

/** طلب إجازة (hr_leave_requests) — days = أيام العمل داخل المدى */
export interface LeaveRequest extends BaseAuditableEntity {
  tenant_id: TenantId
  employee_id: UUID
  employee_name: string
  leave_type_id: UUID
  leave_type_name: string
  start_date: ISODate
  end_date: ISODate
  /** أيام العمل المحسوبة من المدى حسب أيام عمل الشركة (>= 1) */
  days: number
  reason: string | null
  status: LeaveRequestStatus
  /** سبب الرفض — إلزامي عند الرفض، وإلا null */
  rejection_reason: string | null
  /** من قرر (اعتمادًا/رفضًا) — uuid مستخدم الجلسة، null = لم يُقرر بعد */
  decided_by: string | null
  /** متى قُرر — ISO، null = لم يُقرر بعد */
  decided_at: string | null
}

/** ملخص دورة رواتب شهرية (قسم Payroll — عرض فقط في هذه النسخة) */
export interface PayrollSummary {
  tenant_id: TenantId
  period: string // "2025-10"
  total_employees: number
  total_gross: number
  total_deductions: number
  total_net: number
  currency: string
}

// ─── مدخلات الإنشاء ──────────────────────────────────────────────────────────

/** بيانات إدخال موظف جديد */
export interface CreateEmployeeInput {
  full_name: string
  email: string
  phone: string | null
  job_title: string
  department_id: UUID
  position_id: UUID | null
  hire_date: ISODate
  salary: number | null
  status: EmployeeStatus
}

/** بيانات إدخال إدارة جديدة */
export interface CreateDepartmentInput {
  name: string
  code: string
  manager_name: string | null
}

/** بيانات إدخال منصب جديد */
export interface CreatePositionInput {
  code: string
  title: string
  department_id: UUID | null
}

/** بيانات طلب إجازة جديد — days يُشتق عبر محرك القواعد ولا يُرسل */
export interface CreateLeaveRequestInput {
  employee_id: UUID
  leave_type_id: UUID
  start_date: ISODate
  end_date: ISODate
  reason: string | null
}

/** بيانات إنشاء نوع إجازة — annual_days = null يعني بلا حد سنوي */
export interface CreateLeaveTypeInput {
  name: string
  description: string | null
  annual_days: number | null
  is_paid: boolean
  is_active: boolean
}

/** بيانات إدخال سجل حضور (يدوي أو تصحيح) */
export interface CreateAttendanceInput {
  employee_id: UUID
  date: ISODate
  status: AttendanceStatus
  check_in: TimeClock | null
  check_out: TimeClock | null
  note: string | null
}

// ─── مدخلات التعديل — نفس أشكال الإنشاء كأنواع مستقلة صريحة ────────────────

/** بيانات تعديل موظف — النموذج المشترك يعيد إرسال كل الحقول */
export interface UpdateEmployeeInput extends CreateEmployeeInput {}

/** بيانات تعديل إدارة */
export interface UpdateDepartmentInput extends CreateDepartmentInput {}

/** بيانات تعديل منصب */
export interface UpdatePositionInput extends CreatePositionInput {}

/** بيانات تعديل سجل حضور — النموذج يعيد إرسال كل الحقول */
export interface UpdateAttendanceInput extends CreateAttendanceInput {}

/** بيانات تعديل طلب إجازة — الطلبات المعلقة فقط حسب العقد */
export interface UpdateLeaveRequestInput extends CreateLeaveRequestInput {}

/** بيانات تعديل نوع إجازة */
export interface UpdateLeaveTypeInput extends CreateLeaveTypeInput {}

/** بيانات تعديل إعدادات قواعد الحضور */
export interface UpdateAttendanceSettingsInput {
  work_start: TimeClock
  work_end: TimeClock
  late_grace_minutes: number
  work_days: number[]
  overtime_enabled: boolean
}
