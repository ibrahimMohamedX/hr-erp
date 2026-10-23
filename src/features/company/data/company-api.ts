/**
 * Company API — طبقة موحدة بين واجهة الشركة وبياناتها.
 *
 * وضعان بنفس العقد تمامًا (نفس فلسفة PlatformApi في features/platform/data/api.ts):
 *  - live: مشروع Supabase حقيقي للشركة (جداول hr_employees/hr_departments/
 *    hr_positions/hr_attendance/hr_attendance_settings/hr_leave_types/
 *    hr_leave_requests)
 *  - demo: المتجر المحاكي (نفس السلوك 1:1 مع ثبات عبر sessionStorage)
 *
 * التحول بينهما تلقائي حسب الإعداد (appEnv.companyMode) — لا صفحة تتغير.
 *
 * عقد الأخطاء الموحد بين الوضعين (نفس أسلوب "Department has employees"):
 *   "Attendance record already exists" · "Attendance record not found" ·
 *   "No check-in today" · "Already checked in today" · "Already checked out" ·
 *   "Leave request not found" · "Leave type not found" ·
 *   "Leave type already exists" · "Leave type has requests" ·
 *   "End date before start date" · "No working days in range" ·
 *   "Leave request overlaps existing dates" · "Insufficient leave balance" ·
 *   "Only pending requests can be modified" ·
 *   "Only pending requests can be decided" ·
 *   "Only pending or approved requests can be cancelled" ·
 *   "Rejection reason is required" · "Only approved requests can be synced to attendance"
 */

import type {
  AttendanceRecord,
  AttendanceSettings,
  CreateAttendanceInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  CreatePositionInput,
  Department,
  Employee,
  LeaveRequest,
  LeaveTypeDefinition,
  Position,
  UpdateAttendanceInput,
  UpdateAttendanceSettingsInput,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  UpdateLeaveRequestInput,
  UpdateLeaveTypeInput,
  UpdatePositionInput,
  UUID,
} from "@/types"

export interface CompanyApi {
  mode: "live" | "demo"

  // ─── الموظفون ────────────────────────────────────────────────────────
  listEmployees(): Promise<Employee[]>
  getEmployee(id: UUID): Promise<Employee | null>
  createEmployee(input: CreateEmployeeInput): Promise<Employee>
  updateEmployee(id: UUID, input: UpdateEmployeeInput): Promise<Employee>

  // ─── الإدارات ────────────────────────────────────────────────────────
  listDepartments(): Promise<Department[]>
  createDepartment(input: CreateDepartmentInput): Promise<Department>
  updateDepartment(id: UUID, input: UpdateDepartmentInput): Promise<Department>
  /** يرفض — خطأ واضح — لو يوجد موظفون في القسم (يطابق restrict في DB) */
  deleteDepartment(id: UUID): Promise<void>

  // ─── المناصب ─────────────────────────────────────────────────────────
  listPositions(): Promise<Position[]>
  createPosition(input: CreatePositionInput): Promise<Position>
  updatePosition(id: UUID, input: UpdatePositionInput): Promise<Position>
  /** يصفّر position_id عند الموظفين ثم يحذف (يطابق on delete set null) */
  deletePosition(id: UUID): Promise<void>

  // ─── الحضور والانصراف ────────────────────────────────────────────────
  /** السجل الكامل (الأحدث أولًا؛ داخل اليوم حسب employee_name) */
  listAttendance(): Promise<AttendanceRecord[]>
  /** يرفض "Attendance record already exists" لو يخالف unique(employee_id, work_date) */
  createAttendance(input: CreateAttendanceInput): Promise<AttendanceRecord>
  /** يرفض "Attendance record not found" لو السجل غير موجود */
  updateAttendance(id: UUID, input: UpdateAttendanceInput): Promise<AttendanceRecord>
  /** يرفض "Attendance record not found" لو السجل غير موجود */
  deleteAttendance(id: UUID): Promise<void>
  /**
   * تسجيل حضور الآن للموظف:
   *  - سجل اليوم موجود وببه check_in → "Already checked in today"
   *  - سجل اليوم موجود بلا check_in (غائب/إجازة) → يضع check_in الآن
   *    ويعيد اشتقاق status عبر deriveCheckInStatus (يتجاوز absent/on_leave)
   *  - لا سجل → إنشاء سجل جديد لليوم بـ check_in الآن
   *  check_out يبقى null في كل المسارات.
   */
  checkIn(employeeId: UUID): Promise<AttendanceRecord>
  /**
   * تسجيل انصراف الآن للموظف:
   *  - لا سجل اليوم أو السجل بلا check_in → "No check-in today"
   *  - check_out موجود مسبقًا → "Already checked out"
   *  - غير ذلك يضع check_out الآن
   */
  checkOut(employeeId: UUID): Promise<AttendanceRecord>
  /** إعدادات قواعد الحضور — الافتراضات عند غياب صف مخصص */
  getAttendanceSettings(): Promise<AttendanceSettings>
  updateAttendanceSettings(input: UpdateAttendanceSettingsInput): Promise<AttendanceSettings>

  // ─── الإجازات ────────────────────────────────────────────────────────

  /** أنواع الإجازات النشطة والمعطلة (الاسم تصاعديًا) */
  listLeaveTypes(): Promise<LeaveTypeDefinition[]>
  /** يرفض "Leave type already exists" عند تكرار الاسم */
  createLeaveType(input: CreateLeaveTypeInput): Promise<LeaveTypeDefinition>
  /** يرفض "Leave type not found" */
  updateLeaveType(id: UUID, input: UpdateLeaveTypeInput): Promise<LeaveTypeDefinition>
  /** يرفض "Leave type has requests" — أو "Leave type not found" */
  deleteLeaveType(id: UUID): Promise<void>

  /** كل الطلبات (الأحدث بدايةً أولًا؛ داخل نفس اليوم حسب تاريخ الإنشاء) */
  listLeaveRequests(): Promise<LeaveRequest[]>
  /**
   * تقديم طلب جديد بحالة pending — التحقق الموحد (تواريخ/أيام عمل/
   * تداخل/رصيد) عبر محرك leave-rules قبل الكتابة في الوضعين معًا.
   * يرفض: "End date before start date" · "No working days in range" ·
   * "Leave request overlaps existing dates" · "Insufficient leave balance"
   */
  createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest>
  /** تعديل الطلبات المعلقة فقط — "Only pending requests can be modified" */
  updateLeaveRequest(
    id: UUID,
    input: UpdateLeaveRequestInput,
  ): Promise<LeaveRequest>
  /** إلغاء المعلق أو المعتمد — "Only pending or approved requests can be cancelled" */
  cancelLeaveRequest(id: UUID): Promise<LeaveRequest>
  /** اعتماد طلب معلق — يثبّت decided_at/decided_by */
  approveLeaveRequest(id: UUID): Promise<LeaveRequest>
  /** رفض طلب معلق بسبب إلزامي — "Rejection reason is required" */
  rejectLeaveRequest(id: UUID, reason: string): Promise<LeaveRequest>
  /**
   * الربط الآمن بالحضور: لكل يوم عمل في مدى طلب معتمد بلا سجل حضور،
   * إنشاء سجل on_leave — لا يعدّل أي سجل قائم أبدًا.
   * يعيد عدد السجلات المُنشأة. فعل صريح — لا شيء تلقائي.
   */
  applyLeaveToAttendance(requestId: UUID): Promise<number>
}

// ─── حاجز الوضع الوحيد ─────────────────────────────────────────────────────

import { appEnv } from "@/config/env"
import { liveCompanyApi } from "./live-api"
import { demoCompanyApi } from "./demo-api"

/**
 * الـ API الفعّال حسب الإعداد — live عند توفر مشروع Supabase للشركة
 * (VITE_SUPABASE_*) وإلا demo (المتجر المحاكي الموسوم).
 */
export function getCompanyApi(): CompanyApi {
  return appEnv.companyMode === "live" ? liveCompanyApi : demoCompanyApi
}
