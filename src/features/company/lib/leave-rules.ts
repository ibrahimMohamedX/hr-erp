/**
 * محرك قواعد الإجازات النقي — المصدر الوحيد لكل حسابات الإجازات.
 * يستهلكه live-api وdemo-api والواجهات معًا — لا منطق مكرر في أي مكان.
 *
 * نفس فلسفة attendance-rules: دوال نقية بلا React/btoa/شبكة —
 * قابلة للاختبار ومطابقة 1:1 بين الوضعين.
 *
 * ⚠️ درس attendance (فخ UTC): التاريخ "YYYY-MM-DD" يُفكك يدويًا
 *    `const [y, m, d] = str.split("-").map(Number)` ثم `new Date(y, m - 1, d)`
 *    — لا `new Date("YYYY-MM-DD")` أبدًا (يعكس اليوم في مناطق UTC السالبة).
 */

import type {
  Employee,
  ISODate,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveTypeDefinition,
} from "@/types"

// ─── أدوات التاريخ النقية ──────────────────────────────────────────────────

/** تفكيك "YYYY-MM-DD" يدويًا — بديل آمن عن new Date(str) (فخ UTC) */
export function parseLocalDate(date: ISODate): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/** التنسيق العكسي: Date محلي → "YYYY-MM-DD" */
export function toLocalDateISO(date: Date): ISODate {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** كل التواريخ في المدى [start, end] ضمنيًا (بما فيه الطرفان) */
export function eachDateInRange(start: ISODate, end: ISODate): ISODate[] {
  const dates: ISODate[] = []
  const from = parseLocalDate(start)
  const to = parseLocalDate(end)
  // حماية من مدى معكوس أو شاسع (سقف 370 يومًا)
  if (to < from || (to.getTime() - from.getTime()) / 86_400_000 > 370) {
    return dates
  }
  const cursor = new Date(from)
  while (cursor <= to) {
    dates.push(toLocalDateISO(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

/** هل اليوم يوم عمل حسب اصطلاح getDay (0=الأحد … 6=السبت)؟ */
export function isLeaveWorkDay(date: ISODate, workDays: number[]): boolean {
  return workDays.includes(parseLocalDate(date).getDay())
}

/** عدد أيام العمل في المدى (0 إذا معكوس أو فارغ) */
export function countWorkingDays(
  start: ISODate,
  end: ISODate,
  workDays: number[],
): number {
  return eachDateInRange(start, end).filter((d) =>
    isLeaveWorkDay(d, workDays),
  ).length
}

// ─── انتقالات الحالة ────────────────────────────────────────────────────────

/** التعديل مسموح للطلبات المعلقة فقط */
export function canModifyLeave(status: LeaveRequestStatus): boolean {
  return status === "pending"
}

/** الموافقة/الرفض مسموح للطلبات المعلقة فقط */
export function canDecideLeave(status: LeaveRequestStatus): boolean {
  return status === "pending"
}

/** الإلغاء مسموح للمعلق والمعتمد (المرفوض والملغى نهائيان) */
export function canCancelLeave(status: LeaveRequestStatus): boolean {
  return status === "pending" || status === "approved"
}

// ─── التداخل ────────────────────────────────────────────────────────────────

/**
 * هل يتعارض المدى المقترح مع طلب قائم لنفس الموظف؟
 * التداخل ضد pending + approved فقط — المرفوض والملغى لا يحجبان شيئًا.
 * تُستخدم لصنع القرار قبل التقديم، وتُفسد المدى المشترك بالشرط القياسي:
 * startA <= endB && endA >= startB.
 */
export function findLeaveOverlap(
  requests: LeaveRequest[],
  employeeId: string,
  start: ISODate,
  end: ISODate,
  excludeId?: string,
): LeaveRequest | null {
  return (
    requests.find(
      (r) =>
        r.employee_id === employeeId &&
        r.id !== excludeId &&
        (r.status === "pending" || r.status === "approved") &&
        r.start_date <= end &&
        r.end_date >= start,
    ) ?? null
  )
}

// ─── الأرصدة والاستحقاق ──────────────────────────────────────────────────────

/** مجموع أيام الطلبات المعتمدة لنوعٍ وموظف في سنة معينة (سنة start_date) */
export function sumApprovedLeaveDays(
  requests: LeaveRequest[],
  employeeId: string,
  leaveTypeId: string,
  year: number,
  excludeId?: string,
): number {
  return requests
    .filter(
      (r) =>
        r.employee_id === employeeId &&
        r.leave_type_id === leaveTypeId &&
        r.id !== excludeId &&
        r.status === "approved" &&
        parseLocalDate(r.start_date).getFullYear() === year,
    )
    .reduce((sum, r) => sum + r.days, 0)
}

/** سطر رصيد لموظف × نوع */
export interface LeaveBalanceEntry {
  employee_id: string
  employee_name: string
  leave_type_id: string
  leave_type_name: string
  /** الاستحقاق السنوي — null = بلا حد */
  entitled: number | null
  /** المستهلك المعتمد هذه السنة */
  used: number
  /** المتبقي — null = بلا حد */
  remaining: number | null
}

/**
 * جدول الأرصدة لكل موظف × نوع نشط في سنة معينة.
 * النوع غير المحدود (annual_days = null) → entitled/remaining = null.
 */
export function computeLeaveBalances(
  employees: Array<Pick<Employee, "id" | "full_name">>,
  types: LeaveTypeDefinition[],
  requests: LeaveRequest[],
  year: number,
): LeaveBalanceEntry[] {
  const entries: LeaveBalanceEntry[] = []
  for (const employee of employees) {
    for (const type of types) {
      if (!type.is_active) continue
      const used = sumApprovedLeaveDays(
        requests,
        employee.id,
        type.id,
        year,
      )
      entries.push({
        employee_id: employee.id,
        employee_name: employee.full_name,
        leave_type_id: type.id,
        leave_type_name: type.name,
        entitled: type.annual_days,
        used,
        remaining:
          type.annual_days === null ? null : type.annual_days - used,
      })
    }
  }
  return entries
}

// ─── التحقق الموحد قبل الإنشاء/التعديل ─────────────────────────────────────

export interface LeaveValidationInput {
  requests: LeaveRequest[]
  types: LeaveTypeDefinition[]
  employeeId: string
  leaveTypeId: string
  start: ISODate
  end: ISODate
  workDays: number[]
  /** عند التعديل: استبعاد الطلب نفسه من فحصَي التداخل والرصيد */
  excludeId?: string
}

export interface LeaveValidationResult {
  /** رسالة عقد الخطأ أو null عند الصلاح */
  error: string | null
  /** أيام العمل في المدى (صالح فقط عند error = null) */
  days: number
}

/**
 * التحقق الكامل بترتيب عقد ثابت: التواريخ → أيام العمل → التداخل → الرصيد.
 * نفس النصوص حرفيًا في live وdemo — رسائل العقد الموحدة.
 */
export function validateLeaveWindow(
  input: LeaveValidationInput,
): LeaveValidationResult {
  if (input.end < input.start) {
    return { error: "End date before start date", days: 0 }
  }
  const days = countWorkingDays(input.start, input.end, input.workDays)
  if (days < 1) {
    return { error: "No working days in range", days: 0 }
  }
  const overlap = findLeaveOverlap(
    input.requests,
    input.employeeId,
    input.start,
    input.end,
    input.excludeId,
  )
  if (overlap) {
    return { error: "Leave request overlaps existing dates", days }
  }
  const type = input.types.find((t) => t.id === input.leaveTypeId)
  if (type && type.annual_days !== null) {
    const year = parseLocalDate(input.start).getFullYear()
    const used = sumApprovedLeaveDays(
      input.requests,
      input.employeeId,
      input.leaveTypeId,
      year,
      input.excludeId,
    )
    if (used + days > type.annual_days) {
      return { error: "Insufficient leave balance", days }
    }
  }
  return { error: null, days }
}

// ─── مؤشرات العرض (KPI) ────────────────────────────────────────────────────

/** مجموع أيام الطلبات المعتمدة التي تبدأ اليوم أو بعده */
export function upcomingApprovedDays(
  requests: LeaveRequest[],
  todayStr: ISODate,
): number {
  return requests
    .filter(
      (r) => r.status === "approved" && r.start_date >= todayStr,
    )
    .reduce((sum, r) => sum + r.days, 0)
}

/** عدادات الحالة للوحة المؤشرات */
export function leaveStatusCounts(
  requests: LeaveRequest[],
): Record<LeaveRequestStatus, number> {
  const counts: Record<LeaveRequestStatus, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
  }
  for (const r of requests) {
    counts[r.status] += 1
  }
  return counts
}
