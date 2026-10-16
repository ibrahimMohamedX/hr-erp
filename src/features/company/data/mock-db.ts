/**
 * ⚠️ بيانات تجريبية (Mock) — منطقة الشركة التجريبية "نُوى تك".
 * لم تُربط بقاعدة بيانات فعلية بعد — عند اكتمال migrations يستبدل
 * هذا الملف باستدعاءات Supabase الفعلية بنفس العقود.
 */

import type {
  AttendanceRecord,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  Department,
  Employee,
  LeaveRequest,
  PayrollSummary,
  UUID,
} from "@/types"

const TENANT = "demo-tenant-nawa"
const now = new Date().toISOString()
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString()
const dateDaysAgo = (n: number) => daysAgo(n).slice(0, 10)
const today = () => new Date().toISOString().slice(0, 10)

// ─── الإدارات ───────────────────────────────────────────────────────────────

const departments: Department[] = [
  { id: "dep-eng", created_at: daysAgo(420), updated_at: daysAgo(30), tenant_id: TENANT, name: "هندسة البرمجيات", code: "ENG", manager_name: "خالد الشاذلي" },
  { id: "dep-hr", created_at: daysAgo(420), updated_at: daysAgo(30), tenant_id: TENANT, name: "الموارد البشرية", code: "HR", manager_name: "أحمد سامي" },
  { id: "dep-sales", created_at: daysAgo(360), updated_at: daysAgo(30), tenant_id: TENANT, name: "المبيعات", code: "SALES", manager_name: "ياسمين فتحي" },
  { id: "dep-fin", created_at: daysAgo(360), updated_at: daysAgo(30), tenant_id: TENANT, name: "المالية", code: "FIN", manager_name: "عمر حجازي" },
  { id: "dep-ops", created_at: daysAgo(300), updated_at: daysAgo(30), tenant_id: TENANT, name: "العمليات", code: "OPS", manager_name: "نورهان عادل" },
]

// ─── الموظفين ───────────────────────────────────────────────────────────────

const e = (
  n: number,
  name: string,
  email: string,
  title: string,
  dep: string,
  hireDays: number,
  salary: number,
  status: Employee["status"] = "active",
): Employee => ({
  id: `emp-${String(n).padStart(3, "0")}`,
  created_at: daysAgo(hireDays),
  updated_at: daysAgo(5),
  tenant_id: TENANT,
  employee_code: `EMP-${String(n).padStart(3, "0")}`,
  full_name: name,
  email,
  phone: `+20 10 ${String(2000 + n).slice(-4)} ${String(10000 + n * 7).slice(-4)}`,
  job_title: title,
  department_id: dep,
  hire_date: dateDaysAgo(hireDays),
  salary,
  status,
})

const employees: Employee[] = [
  e(1, "خالد الشاذلي", "khalid@nawa-tech.demo", "قائد فريق الواجهة الأمامية", "dep-eng", 1180, 42000),
  e(2, "مروة عابد", "marwa@nawa-tech.demo", "مهندسة برمجيات أولى", "dep-eng", 940, 34000),
  e(3, "زياد منصور", "ziad@nawa-tech.demo", "مهندس DevOps", "dep-eng", 620, 31000),
  e(4, "سلمى الديب", "salma@nawa-tech.demo", "مهندسة برمجيات", "dep-eng", 210, 26000, "probation"),
  e(5, "أحمد سامي", "ahmed@nawa-tech.demo", "مدير الموارد البشرية", "dep-hr", 1180, 38000),
  e(6, "منى عبد الرحمن", "mona@nawa-tech.demo", "أخصائية موارد بشرية", "dep-hr", 540, 22000),
  e(7, "ياسمين فتحي", "yasmine@nawa-tech.demo", "مديرة المبيعات", "dep-sales", 900, 36000),
  e(8, "طارق بدوي", "tarek@nawa-tech.demo", "مسؤول مبيعات أول", "dep-sales", 470, 24000),
  e(9, "هدى شريف", "hoda@nawa-tech.demo", "مسؤولة حسابات", "dep-sales", 150, 18000, "probation"),
  e(10, "عمر حجازي", "omar@nawa-tech.demo", "المدير المالي", "dep-fin", 1120, 40000),
  e(11, "داليا رشاد", "dalia@nawa-tech.demo", "محاسبة", "dep-fin", 730, 21000),
  e(12, "مصطفى كمال", "mostafa@nawa-tech.demo", "محاسب", "dep-fin", 95, 19000, "probation"),
  e(13, "نورهان عادل", "norhan@nawa-tech.demo", "مديرة العمليات", "dep-ops", 830, 33000),
  e(14, "كريم زكي", "karim@nawa-tech.demo", "مسؤول عمليات", "dep-ops", 390, 20000),
  e(15, "ريم القاضي", "reem@nawa-tech.demo", "مسؤولة دعم فني", "dep-ops", 260, 17000),
  e(16, "حسام الغزالي", "hossam@nawa-tech.demo", "مسؤول مشتريات", "dep-ops", 640, 18500, "suspended"),
]

// ─── حضور اليوم ─────────────────────────────────────────────────────────────

const att = (
  emp: number,
  status: AttendanceRecord["status"],
  checkIn: string | null,
  checkOut: string | null,
): AttendanceRecord => {
  const employee = employees.find((x) => x.id === `emp-${String(emp).padStart(3, "0")}`)!
  return {
    id: `att-${emp}`,
    tenant_id: TENANT,
    employee_id: employee.id,
    employee_name: employee.full_name,
    department_id: employee.department_id,
    date: today(),
    check_in: checkIn,
    check_out: checkOut,
    status,
  }
}

const attendanceToday: AttendanceRecord[] = [
  att(1, "present", "08:52", "17:05"),
  att(2, "present", "09:01", null),
  att(3, "late", "09:24", null),
  att(4, "present", "08:47", null),
  att(5, "present", "08:30", "17:10"),
  att(6, "present", "08:58", null),
  att(7, "on_leave", null, null),
  att(8, "present", "09:06", null),
  att(9, "absent", null, null),
  att(10, "present", "08:41", "17:00"),
  att(11, "present", "08:55", null),
  att(12, "late", "09:18", null),
  att(13, "present", "08:36", null),
  att(14, "present", "09:00", null),
  att(15, "absent", null, null),
  att(16, "absent", null, null),
]

/** ملخص حضور آخر 7 أيام (للرسم البياني) */
export const weeklyAttendance = [
  { day: "السبت", present: 11, late: 3, absent: 2 },
  { day: "الأحد", present: 12, late: 2, absent: 2 },
  { day: "الاثنين", present: 13, late: 2, absent: 1 },
  { day: "الثلاثاء", present: 12, late: 1, absent: 3 },
  { day: "الأربعاء", present: 14, late: 1, absent: 1 },
  { day: "الخميس", present: 13, late: 2, absent: 1 },
  { day: "الجمعة", present: 3, late: 0, absent: 0 },
]

// ─── طلبات الإجازات ──────────────────────────────────────────────────────────

const lv = (
  n: number,
  emp: number,
  type: LeaveRequest["type"],
  status: LeaveRequest["status"],
  fromDaysAgo: number,
  days: number,
  reason: string | null,
): LeaveRequest => {
  const employee = employees.find((x) => x.id === `emp-${String(emp).padStart(3, "0")}`)!
  return {
    id: `leave-${n}`,
    created_at: daysAgo(fromDaysAgo + days),
    updated_at: daysAgo(fromDaysAgo),
    tenant_id: TENANT,
    employee_id: employee.id,
    employee_name: employee.full_name,
    type,
    start_date: dateDaysAgo(fromDaysAgo),
    end_date: dateDaysAgo(Math.max(fromDaysAgo - days + 1, 0)),
    days,
    reason,
    status,
  }
}

const leaveRequests: LeaveRequest[] = [
  lv(1, 7, "annual", "approved", 3, 4, "إجازة سنوية مرتبطة بعطلة الأسبوع"),
  lv(2, 4, "sick", "approved", 6, 2, "تقرير طبي — نزلة معوية"),
  lv(3, 14, "casual", "pending", -2, 1, "ظرف عائلي طارئ"),
  lv(4, 9, "annual", "pending", -1, 5, "سفر زيارة الأهل — أسوان"),
  lv(5, 11, "casual", "pending", 0, 1, "موعد حكومي — تجديد البطاقة"),
  lv(6, 2, "annual", "rejected", 9, 7, "توقيت غير مناسب — تسليم مشروع نواة v2"),
  lv(7, 8, "sick", "approved", 12, 3, "متابعة طبية مجدولة"),
  lv(8, 15, "unpaid", "pending", -4, 10, "إجازة بدون راتب — سفر خارجي"),
]

// ─── ملخص الرواتب (عرض فقط) ────────────────────────────────────────────────

const activeEmployees = employees.filter((x) => x.status !== "terminated")
const totalGross = activeEmployees.reduce((s, x) => s + (x.salary ?? 0), 0)

export const payrollSummary: PayrollSummary = {
  tenant_id: TENANT,
  period: new Date().toISOString().slice(0, 7),
  total_employees: activeEmployees.length,
  total_gross: totalGross,
  total_deductions: Math.round(totalGross * 0.115),
  total_net: totalGross - Math.round(totalGross * 0.115),
  currency: "EGP",
}

// ─── واجهة المتجر ────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function fetchDepartments(): Promise<Department[]> {
  await delay(280)
  return [...departments]
}

export async function fetchEmployees(): Promise<Employee[]> {
  await delay(360)
  return [...employees]
}

export async function fetchAttendanceToday(): Promise<AttendanceRecord[]> {
  await delay(240)
  return [...attendanceToday]
}

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  await delay(300)
  return [...leaveRequests]
}

export async function createEmployee(
  input: CreateEmployeeInput,
): Promise<Employee> {
  await delay(420)
  const next = employees.length + 1
  const employee: Employee = {
    id: `emp-${String(next).padStart(3, "0")}`,
    created_at: now,
    updated_at: now,
    tenant_id: TENANT,
    employee_code: `EMP-${String(next).padStart(3, "0")}`,
    full_name: input.full_name,
    email: input.email,
    phone: null,
    job_title: input.job_title,
    department_id: input.department_id,
    hire_date: input.hire_date,
    salary: input.salary,
    status: "probation",
  }
  employees.push(employee)
  return { ...employee }
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<Department> {
  await delay(300)
  const department: Department = {
    id: `dep-${String(departments.length + 1).padStart(2, "0")}`,
    created_at: now,
    updated_at: now,
    tenant_id: TENANT,
    name: input.name,
    code: input.code.toUpperCase(),
    manager_name: input.manager_name,
  }
  departments.push(department)
  return { ...department }
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<LeaveRequest> {
  await delay(380)
  const employee = employees.find((x) => x.id === input.employee_id)
  const days =
    Math.max(
      Math.round(
        (new Date(input.end_date).getTime() -
          new Date(input.start_date).getTime()) /
          86_400_000,
      ) + 1,
      1,
    )
  const request: LeaveRequest = {
    id: `leave-${leaveRequests.length + 1}`,
    created_at: now,
    updated_at: now,
    tenant_id: TENANT,
    employee_id: input.employee_id,
    employee_name: employee?.full_name ?? "—",
    type: input.type,
    start_date: input.start_date,
    end_date: input.end_date,
    days,
    reason: input.reason,
    status: "pending",
  }
  leaveRequests.unshift(request)
  return { ...request }
}

/** توزيع الموظفين على الإدارات (للوحة الشركة) */
export function employeesByDepartment(
  emps: Employee[],
  deps: Department[],
): Array<{ name: string; code: string; count: number }> {
  return deps.map((d) => ({
    name: d.name,
    code: d.code,
    count: emps.filter((x) => x.department_id === d.id).length,
  }))
}

export type { UUID }
