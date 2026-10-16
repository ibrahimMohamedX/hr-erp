/**
 * أنواع أقسام HR الفعلية — الموظفين والإدارات والحضور والإجازات.
 * هذه الأقسام الأربعة هي المنفذة في النسخة الأولى؛ باقي الأقسام
 * تُعرَّف عند بنائها. كل جدول مستقبلي يحمل tenant_id + RLS (docs/05).
 */

import type { BaseAuditableEntity, ISODate, TimeClock, UUID } from "./common"
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
}

/** أنواع الإجازات المدعومة (قسم Leaves) */
export type LeaveType = "annual" | "sick" | "casual" | "unpaid"

/** حالة طلب الإجازة */
export type LeaveRequestStatus = "pending" | "approved" | "rejected"

/** طلب إجازة (قسم Leaves) */
export interface LeaveRequest extends BaseAuditableEntity {
  tenant_id: TenantId
  employee_id: UUID
  employee_name: string
  type: LeaveType
  start_date: ISODate
  end_date: ISODate
  days: number
  reason: string | null
  status: LeaveRequestStatus
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

/** بيانات إدخال موظف جديد */
export interface CreateEmployeeInput {
  full_name: string
  email: string
  job_title: string
  department_id: UUID
  hire_date: ISODate
  salary: number | null
}

/** بيانات إدخال إدارة جديدة */
export interface CreateDepartmentInput {
  name: string
  code: string
  manager_name: string | null
}

/** بيانات طلب إجازة جديد */
export interface CreateLeaveRequestInput {
  employee_id: UUID
  type: LeaveType
  start_date: ISODate
  end_date: ISODate
  reason: string | null
}
