/**
 * ⚠️ بيانات تجريبية (Mock) — منطقة الشركة التجريبية "نُوى تك".
 * لم تُربط بقاعدة بيانات فعلية بعد — عند اكتمال migrations يستبدل
 * هذا الملف باستدعاءات Supabase الفعلية بنفس العقود (features/company/data/live-api.ts).
 *
 * الثبات: أي تعديل يُحفظ في sessionStorage ويُستعاد عند إقلاع الصفحة —
 * مطابق لسلوك live حيث البيانات على الخادم تنجو من أي refresh.
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
  PayrollSummary,
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
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  deriveCheckInStatus,
  isWorkDay,
  localNowTime,
  localToday,
  minutesToTime,
} from "../lib/attendance-rules"
import {
  canCancelLeave,
  canDecideLeave,
  canModifyLeave,
  countWorkingDays,
  eachDateInRange,
  isLeaveWorkDay,
  validateLeaveWindow,
} from "../lib/leave-rules"

const TENANT = "demo-tenant-nawa"
const now = new Date().toISOString()
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString()
const dateDaysAgo = (n: number) => daysAgo(n).slice(0, 10)
const today = () => new Date().toISOString().slice(0, 10)

// ─── ثبات المتجر عبر الـ reload (مطابق لسلوك live) ─────────────────────────

const STORE_KEY = "archai:company-demo-store"

interface DemoStoreState {
  departments: Department[]
  employees: Employee[]
  positions: Position[]
  attendance: AttendanceRecord[]
  attendanceSettings: AttendanceSettings
  leaveTypes: LeaveTypeDefinition[]
  leaveRequests: LeaveRequest[]
}

// ─── الإدارات ───────────────────────────────────────────────────────────────

const departments: Department[] = [
  { id: "dep-eng", created_at: daysAgo(420), updated_at: daysAgo(30), tenant_id: TENANT, name: "هندسة البرمجيات", code: "ENG", manager_name: "خالد الشاذلي" },
  { id: "dep-hr", created_at: daysAgo(420), updated_at: daysAgo(30), tenant_id: TENANT, name: "الموارد البشرية", code: "HR", manager_name: "أحمد سامي" },
  { id: "dep-sales", created_at: daysAgo(360), updated_at: daysAgo(30), tenant_id: TENANT, name: "المبيعات", code: "SALES", manager_name: "ياسمين فتحي" },
  { id: "dep-fin", created_at: daysAgo(360), updated_at: daysAgo(30), tenant_id: TENANT, name: "المالية", code: "FIN", manager_name: "عمر حجازي" },
  { id: "dep-ops", created_at: daysAgo(300), updated_at: daysAgo(30), tenant_id: TENANT, name: "العمليات", code: "OPS", manager_name: "نورهان عادل" },
]

// ─── المناصب (Positions) ─────────────────────────────────────────────────────

const positions: Position[] = [
  { id: "pos-se2", created_at: daysAgo(500), updated_at: daysAgo(30), tenant_id: TENANT, code: "SE2", title: "مهندس برمجيات أولى", department_id: "dep-eng" },
  { id: "pos-se1", created_at: daysAgo(500), updated_at: daysAgo(30), tenant_id: TENANT, code: "SE1", title: "مهندس برمجيات", department_id: "dep-eng" },
  { id: "pos-devops", created_at: daysAgo(400), updated_at: daysAgo(30), tenant_id: TENANT, code: "DEVOPS", title: "مهندس DevOps", department_id: "dep-eng" },
  { id: "pos-hr-spec", created_at: daysAgo(400), updated_at: daysAgo(30), tenant_id: TENANT, code: "HR-SPEC", title: "أخصائي موارد بشرية", department_id: "dep-hr" },
  { id: "pos-sal-rep", created_at: daysAgo(350), updated_at: daysAgo(30), tenant_id: TENANT, code: "SAL-REP", title: "مسؤول مبيعات", department_id: "dep-sales" },
  { id: "pos-fin-acc", created_at: daysAgo(350), updated_at: daysAgo(30), tenant_id: TENANT, code: "FIN-ACC", title: "محاسب", department_id: "dep-fin" },
  { id: "pos-ops-adm", created_at: daysAgo(300), updated_at: daysAgo(30), tenant_id: TENANT, code: "OPS-ADM", title: "مسؤول عمليات", department_id: "dep-ops" },
  { id: "pos-support", created_at: daysAgo(280), updated_at: daysAgo(30), tenant_id: TENANT, code: "SUPPORT", title: "مسؤول دعم فني", department_id: "dep-ops" },
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
  positionId: string | null = null,
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
  position_id: positionId,
  hire_date: dateDaysAgo(hireDays),
  salary,
  status,
})

const employees: Employee[] = [
  e(1, "خالد الشاذلي", "khalid@nawa-tech.demo", "قائد فريق الواجهة الأمامية", "dep-eng", 1180, 42000, "active", "pos-se2"),
  e(2, "مروة عابد", "marwa@nawa-tech.demo", "مهندسة برمجيات أولى", "dep-eng", 940, 34000, "active", "pos-se2"),
  e(3, "زياد منصور", "ziad@nawa-tech.demo", "مهندس DevOps", "dep-eng", 620, 31000, "active", "pos-devops"),
  e(4, "سلمى الديب", "salma@nawa-tech.demo", "مهندسة برمجيات", "dep-eng", 210, 26000, "probation", "pos-se1"),
  e(5, "أحمد سامي", "ahmed@nawa-tech.demo", "مدير الموارد البشرية", "dep-hr", 1180, 38000),
  e(6, "منى عبد الرحمن", "mona@nawa-tech.demo", "أخصائية موارد بشرية", "dep-hr", 540, 22000, "active", "pos-hr-spec"),
  e(7, "ياسمين فتحي", "yasmine@nawa-tech.demo", "مديرة المبيعات", "dep-sales", 900, 36000),
  e(8, "طارق بدوي", "tarek@nawa-tech.demo", "مسؤول مبيعات أول", "dep-sales", 470, 24000, "active", "pos-sal-rep"),
  e(9, "هدى شريف", "hoda@nawa-tech.demo", "مسؤولة حسابات", "dep-sales", 150, 18000, "probation"),
  e(10, "عمر حجازي", "omar@nawa-tech.demo", "المدير المالي", "dep-fin", 1120, 40000),
  e(11, "داليا رشاد", "dalia@nawa-tech.demo", "محاسبة", "dep-fin", 730, 21000, "active", "pos-fin-acc"),
  e(12, "مصطفى كمال", "mostafa@nawa-tech.demo", "محاسب", "dep-fin", 95, 19000, "probation", "pos-fin-acc"),
  e(13, "نورهان عادل", "norhan@nawa-tech.demo", "مديرة العمليات", "dep-ops", 830, 33000),
  e(14, "كريم زكي", "karim@nawa-tech.demo", "مسؤول عمليات", "dep-ops", 390, 20000, "active", "pos-ops-adm"),
  e(15, "ريم القاضي", "reem@nawa-tech.demo", "مسؤولة دعم فني", "dep-ops", 260, 17000, "active", "pos-support"),
  e(16, "حسام الغزالي", "hossam@nawa-tech.demo", "مسؤول مشتريات", "dep-ops", 640, 18500, "suspended"),
]

// ─── الاستعادة من sessionStorage عند الإقلاع ────────────────────────────────

try {
  const raw = sessionStorage.getItem(STORE_KEY)
  if (raw) {
    const saved = JSON.parse(raw) as Partial<DemoStoreState>
    // استبدال البذور بما حُفظ — بشرط صحة الأشكال (كل مصفوفة موجودة كمصفوفة)
    if (Array.isArray(saved.employees) && saved.employees.length > 0) {
      employees.length = 0
      employees.push(...saved.employees)
    }
    if (Array.isArray(saved.departments) && saved.departments.length > 0) {
      departments.length = 0
      departments.push(...saved.departments)
    }
    if (Array.isArray(saved.positions)) {
      positions.length = 0
      positions.push(...saved.positions)
    }
  }
} catch {
  // بيانات محفوظة غير صالحة — نتجاهلها ونبدأ بالبذور
}

function persistStore(): void {
  try {
    const state: DemoStoreState = {
      departments: [...departments],
      employees: [...employees],
      positions: [...positions],
      attendance: [...attendanceHistory],
      attendanceSettings: { ...attendanceSettings },
      leaveTypes: [...leaveTypes],
      leaveRequests: [...leaveRequests],
    }
    sessionStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch {
    // تخزين غير متاح — المتجر يعمل في الذاكرة فقط
  }
}

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
    note: null,
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

// ─── إعدادات قواعد الحضور (قابلة للتعديل عبر المتجر) ────────────────────────

let attendanceSettings: AttendanceSettings = {
  ...DEFAULT_ATTENDANCE_SETTINGS,
  tenant_id: TENANT,
}

// ─── السجل التاريخي للحضور (deterministic — لا Math.random) ─────────────────

/**
 * هاش ثابت (emp, daysAgo) → 0..99 — يوزع deterministic:
 * ~70% حضور منتظم · ~20% متأخر · ~5% غياب · ~5% إجازة
 */
const hashAttendance = (emp: number, ago: number) => (emp * 31 + ago * 17) % 100

/**
 * توليد سجل تاريخي للأيام الـ45 الماضية (أيام العمل فقط حسب الإعدادات
 * الافتراضية الأحد–الخميس · الموظفون 1..15 فقط — الموظف الموقوف مستثنى).
 * أوقات deterministic: حضور منتظم 08:30–08:58 · متأخر 09:10–09:40 ·
 * انصراف 16:45–17:30. ids مثل att-<emp>-<daysAgo>. note: null.
 */
function buildHistoricalAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = []
  for (let ago = 1; ago <= 45; ago++) {
    const date = dateDaysAgo(ago)
    // أيام العمل فقط حسب قواعد الحضور (نفس المحرك — لا منطق مكرر)
    if (!isWorkDay(date, attendanceSettings)) continue
    for (let emp = 1; emp <= 15; emp++) {
      const employee = employees.find(
        (x) => x.id === `emp-${String(emp).padStart(3, "0")}`,
      )!
      const h = hashAttendance(emp, ago)
      let status: AttendanceRecord["status"]
      let checkIn: string | null = null
      let checkOut: string | null = null
      if (h < 70) {
        // حضور منتظم: 08:30–08:58
        status = "present"
        checkIn = minutesToTime(8 * 60 + 30 + (h % 29))
        checkOut = minutesToTime(16 * 60 + 45 + ((h * 7) % 46))
      } else if (h < 90) {
        // متأخر: 09:10–09:40
        status = "late"
        checkIn = minutesToTime(9 * 60 + 10 + (h % 31))
        checkOut = minutesToTime(16 * 60 + 45 + ((h * 7) % 46))
      } else if (h < 95) {
        status = "absent"
      } else {
        status = "on_leave"
      }
      records.push({
        id: `att-${emp}-${ago}`,
        tenant_id: TENANT,
        employee_id: employee.id,
        employee_name: employee.full_name,
        department_id: employee.department_id,
        date,
        check_in: checkIn,
        check_out: checkOut,
        status,
        note: null,
      })
    }
  }
  return records
}

/**
 * السجل الكامل: لقطة اليوم أولًا (بنفس ترتيبها الأصلي حرفيًا)
 * ثم التاريخي (الأحدث أولًا).
 */
const attendanceHistory: AttendanceRecord[] = [
  ...attendanceToday,
  ...buildHistoricalAttendance(),
]

// ─── استعادة الحضور والإعدادات من المتجر المحفوظ ────────────────────────────
// (متاجر قديلة بلا attendance → تبقى بذور الحضور كما هي — لا كسر)

try {
  const raw = sessionStorage.getItem(STORE_KEY)
  if (raw) {
    const saved = JSON.parse(raw) as Partial<DemoStoreState>
    if (Array.isArray(saved.attendance)) {
      // متاجر أقدم قد تحوي سجلات بلا note — نحتط بـ null
      attendanceHistory.length = 0
      attendanceHistory.push(
        ...saved.attendance.map((r) => ({ ...r, note: r.note ?? null })),
      )
    }
    if (
      saved.attendanceSettings &&
      typeof saved.attendanceSettings.work_start === "string"
    ) {
      attendanceSettings = { ...saved.attendanceSettings, tenant_id: TENANT }
    }
  }
} catch {
  // بيانات محفوظة غير صالحة — نتجاهلها ونبدأ ببذور الحضور
}

// ─── الإجازات: الأنواع والطلبات ──────────────────────────────────────────────

/** أنواع الإجازات — دليل قابل للتهيئة (نفس hr_leave_types في live) */
const leaveTypes: LeaveTypeDefinition[] = [
  { id: "lt-annual", tenant_id: TENANT, name: "إجازة سنوية", description: "الاستحقاق السنوي النظامي", annual_days: 21, is_paid: true, is_active: true, created_at: daysAgo(420) },
  { id: "lt-sick", tenant_id: TENANT, name: "إجازة مرضية", description: "بتقرير طبي", annual_days: 10, is_paid: true, is_active: true, created_at: daysAgo(420) },
  { id: "lt-casual", tenant_id: TENANT, name: "إجازة عارضة", description: "أيام قصيرة طارئة", annual_days: 7, is_paid: true, is_active: true, created_at: daysAgo(420) },
  { id: "lt-unpaid", tenant_id: TENANT, name: "إجازة بدون راتب", description: "بلا رصيد — بدون أجر", annual_days: null, is_paid: false, is_active: true, created_at: daysAgo(420) },
]

/**
 * بذرة طلب إجازة — الإزاحات بالأيام عن اليوم (سالب = مستقبل) وdays
 * يُحسب بأيام العمل عبر محرك القواعد (deterministic مع إعدادات الشركة).
 */
const lv = (
  n: number,
  emp: number,
  typeId: string,
  status: LeaveRequest["status"],
  fromAgo: number,
  toAgo: number,
  reason: string | null,
  decidedAgo?: number,
  rejectionReason?: string,
): LeaveRequest => {
  const employee = employees.find((x) => x.id === `emp-${String(emp).padStart(3, "0")}`)!
  const type = leaveTypes.find((t) => t.id === typeId)!
  const start_date = dateDaysAgo(fromAgo)
  const end_date = dateDaysAgo(toAgo)
  return {
    id: `leave-${n}`,
    created_at: daysAgo(Math.max(fromAgo, 0) + 3),
    updated_at: decidedAgo !== undefined ? daysAgo(decidedAgo) : daysAgo(Math.max(fromAgo, 0) + 1),
    tenant_id: TENANT,
    employee_id: employee.id,
    employee_name: employee.full_name,
    leave_type_id: type.id,
    leave_type_name: type.name,
    start_date,
    end_date,
    days: countWorkingDays(start_date, end_date, attendanceSettings.work_days),
    reason,
    status,
    rejection_reason: rejectionReason ?? null,
    decided_by: decidedAgo !== undefined ? "company-admin" : null,
    decided_at: decidedAgo !== undefined ? daysAgo(decidedAgo) : null,
  }
}

/**
 * 8 طلبات: 3 approved · 3 pending · 1 rejected · 1 cancelled —
 * موظفو الطلبات من 2,4,7,8,9,11,14,15 (البقية بلا طلبات لفحوص الاختبار).
 * leave-1 يغطي اليوم (تماسكًا مع سجل on_leave في لقطة اليوم)،
 * وleave-7 معتمد مستقبلي (لمؤشر «الأيام القادمة»).
 */
const leaveRequests: LeaveRequest[] = [
  lv(1, 7, "lt-annual", "approved", 3, 0, "إجازة سنوية قصيرة", 2),
  lv(2, 4, "lt-sick", "approved", 6, 5, "تقرير طبي — نزلة معوية", 5),
  lv(3, 8, "lt-casual", "pending", -2, -2, "موعد حكومي — تجديد البطاقة"),
  lv(4, 9, "lt-annual", "pending", -5, -9, "سفر زيارة الأهل — أسوان"),
  lv(5, 11, "lt-casual", "pending", -14, -14, "ظرف عائلي طارئ"),
  lv(6, 2, "lt-annual", "rejected", 9, 3, "توقيت غير مناسب — تسليم مشروع نواة v2", 8, "ضغط تسليم المشروع — أعيد الجدولة الربع القادم"),
  lv(7, 14, "lt-sick", "approved", -21, -24, "متابعة طبية مجدولة", 1),
  lv(8, 15, "lt-unpaid", "cancelled", -10, -19, "إجازة بدون راتب — سفر خارجي"),
]

// ─── استعادة الإجازات من المتجر المحفوظ ─────────────────────────────────────
// (متاجر قديمة بلا حقول الإجازات → تبقى البذور كما هي — لا كسر)

try {
  const raw = sessionStorage.getItem(STORE_KEY)
  if (raw) {
    const saved = JSON.parse(raw) as Partial<DemoStoreState>
    if (Array.isArray(saved.leaveTypes)) {
      leaveTypes.length = 0
      leaveTypes.push(...saved.leaveTypes)
    }
    if (Array.isArray(saved.leaveRequests)) {
      leaveRequests.length = 0
      leaveRequests.push(...saved.leaveRequests)
    }
  }
} catch {
  // بيانات محفوظة غير صالحة — نتجاهلها ونبدأ ببذور الإجازات
}

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

// ─── القراءة ─────────────────────────────────────────────────────────────────

export async function fetchDepartments(): Promise<Department[]> {
  await delay(280)
  return [...departments]
}

export async function fetchEmployees(): Promise<Employee[]> {
  await delay(360)
  return [...employees]
}

export async function fetchPositions(): Promise<Position[]> {
  await delay(300)
  return [...positions]
}

export async function fetchEmployee(id: UUID): Promise<Employee | null> {
  await delay(240)
  const found = employees.find((x) => x.id === id)
  return found ? { ...found } : null
}

export async function fetchAttendanceToday(): Promise<AttendanceRecord[]> {
  await delay(240)
  return attendanceHistory
    .filter((r) => r.date === today())
    .map((r) => ({ ...r }))
}

export async function fetchLeaveRequests(): Promise<LeaveRequest[]> {
  await delay(300)
  return leaveRequests.map((r) => ({ ...r }))
}

export async function fetchLeaveTypes(): Promise<LeaveTypeDefinition[]> {
  await delay(260)
  // مرتبة بالاسم — مطابق عقد listLeaveTypes في live (order name asc)
  return [...leaveTypes]
    .sort((a, b) => a.name.localeCompare(b.name, "ar"))
    .map((t) => ({ ...t }))
}

// ─── الإنشاء ─────────────────────────────────────────────────────────────────

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
    phone: input.phone,
    job_title: input.job_title,
    department_id: input.department_id,
    position_id: input.position_id,
    hire_date: input.hire_date,
    salary: input.salary,
    status: input.status,
  }
  employees.push(employee)
  persistStore()
  return { ...employee }
}

export async function createDepartment(
  input: CreateDepartmentInput,
): Promise<Department> {
  await delay(300)
  const department: Department = {
    id: `dep-${String(departments.length + 1).padStart(2, "0")}-${Date.now() % 1000}`,
    created_at: now,
    updated_at: now,
    tenant_id: TENANT,
    name: input.name,
    code: input.code.toUpperCase(),
    manager_name: input.manager_name,
  }
  departments.push(department)
  persistStore()
  return { ...department }
}

export async function createPosition(
  input: CreatePositionInput,
): Promise<Position> {
  await delay(320)
  const position: Position = {
    id: `pos-${String(positions.length + 1).padStart(2, "0")}-${Date.now() % 1000}`,
    created_at: now,
    updated_at: now,
    tenant_id: TENANT,
    code: input.code.toUpperCase(),
    title: input.title,
    department_id: input.department_id,
  }
  positions.push(position)
  persistStore()
  return { ...position }
}

// ─── الإجازات: الإنشاء والتعديل والقرار والربط (نفس عقد CompanyApi) ────────

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<LeaveRequest> {
  await delay(380)
  // التحقق الموحد (تواريخ → أيام عمل → تداخل → رصيد) — محرك واحد للوضعين
  const validation = validateLeaveWindow({
    requests: leaveRequests,
    types: leaveTypes,
    employeeId: input.employee_id,
    leaveTypeId: input.leave_type_id,
    start: input.start_date,
    end: input.end_date,
    workDays: attendanceSettings.work_days,
  })
  if (validation.error) throw new Error(validation.error)
  const employee = employees.find((x) => x.id === input.employee_id)
  const type = leaveTypes.find((t) => t.id === input.leave_type_id)
  const request: LeaveRequest = {
    id: `leave-${leaveRequests.length + 1}-${Date.now() % 1000}`,
    created_at: now,
    updated_at: now,
    tenant_id: TENANT,
    employee_id: input.employee_id,
    employee_name: employee?.full_name ?? "—",
    leave_type_id: input.leave_type_id,
    leave_type_name: type?.name ?? "—",
    start_date: input.start_date,
    end_date: input.end_date,
    days: validation.days,
    reason: input.reason,
    status: "pending",
    rejection_reason: null,
    decided_by: null,
    decided_at: null,
  }
  leaveRequests.unshift(request)
  persistStore()
  return { ...request }
}

export async function updateLeaveRequest(
  id: UUID,
  input: UpdateLeaveRequestInput,
): Promise<LeaveRequest> {
  await delay(340)
  const request = leaveRequests.find((r) => r.id === id)
  if (!request) throw new Error("Leave request not found")
  if (!canModifyLeave(request.status)) {
    throw new Error("Only pending requests can be modified")
  }
  const validation = validateLeaveWindow({
    requests: leaveRequests,
    types: leaveTypes,
    employeeId: input.employee_id,
    leaveTypeId: input.leave_type_id,
    start: input.start_date,
    end: input.end_date,
    workDays: attendanceSettings.work_days,
    excludeId: id,
  })
  if (validation.error) throw new Error(validation.error)
  const employee = employees.find((x) => x.id === input.employee_id)
  const type = leaveTypes.find((t) => t.id === input.leave_type_id)
  Object.assign(request, {
    employee_id: input.employee_id,
    employee_name: employee?.full_name ?? "—",
    leave_type_id: input.leave_type_id,
    leave_type_name: type?.name ?? "—",
    start_date: input.start_date,
    end_date: input.end_date,
    days: validation.days,
    reason: input.reason,
    updated_at: now,
  })
  persistStore()
  return { ...request }
}

export async function cancelLeaveRequest(id: UUID): Promise<LeaveRequest> {
  await delay(280)
  const request = leaveRequests.find((r) => r.id === id)
  if (!request) throw new Error("Leave request not found")
  if (!canCancelLeave(request.status)) {
    throw new Error("Only pending or approved requests can be cancelled")
  }
  Object.assign(request, { status: "cancelled", updated_at: now })
  persistStore()
  return { ...request }
}

export async function approveLeaveRequest(id: UUID): Promise<LeaveRequest> {
  await delay(280)
  const request = leaveRequests.find((r) => r.id === id)
  if (!request) throw new Error("Leave request not found")
  if (!canDecideLeave(request.status)) {
    throw new Error("Only pending requests can be decided")
  }
  Object.assign(request, {
    status: "approved",
    decided_by: "company-admin",
    decided_at: now,
    updated_at: now,
  })
  persistStore()
  return { ...request }
}

export async function rejectLeaveRequest(
  id: UUID,
  reason: string,
): Promise<LeaveRequest> {
  await delay(280)
  const trimmed = reason.trim()
  if (!trimmed) throw new Error("Rejection reason is required")
  const request = leaveRequests.find((r) => r.id === id)
  if (!request) throw new Error("Leave request not found")
  if (!canDecideLeave(request.status)) {
    throw new Error("Only pending requests can be decided")
  }
  Object.assign(request, {
    status: "rejected",
    rejection_reason: trimmed,
    decided_by: "company-admin",
    decided_at: now,
    updated_at: now,
  })
  persistStore()
  return { ...request }
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
): Promise<LeaveTypeDefinition> {
  await delay(320)
  const name = input.name.trim()
  if (leaveTypes.some((t) => t.name === name)) {
    throw new Error("Leave type already exists")
  }
  const type: LeaveTypeDefinition = {
    id: `lt-${String(leaveTypes.length + 1).padStart(2, "0")}-${Date.now() % 1000}`,
    tenant_id: TENANT,
    name,
    description: input.description,
    annual_days: input.annual_days,
    is_paid: input.is_paid,
    is_active: input.is_active,
    created_at: now,
  }
  leaveTypes.push(type)
  persistStore()
  return { ...type }
}

export async function updateLeaveType(
  id: UUID,
  input: UpdateLeaveTypeInput,
): Promise<LeaveTypeDefinition> {
  await delay(300)
  const type = leaveTypes.find((t) => t.id === id)
  if (!type) throw new Error("Leave type not found")
  const name = input.name.trim()
  if (leaveTypes.some((t) => t.id !== id && t.name === name)) {
    throw new Error("Leave type already exists")
  }
  Object.assign(type, {
    name,
    description: input.description,
    annual_days: input.annual_days,
    is_paid: input.is_paid,
    is_active: input.is_active,
  })
  persistStore()
  return { ...type }
}

export async function deleteLeaveType(id: UUID): Promise<void> {
  await delay(280)
  // مطابق on delete restrict: نوع له طلبات (بأي حالة — سجل تدقيقي) لا يُحذف
  const hasRequests = leaveRequests.some((r) => r.leave_type_id === id)
  if (hasRequests) throw new Error("Leave type has requests")
  const idx = leaveTypes.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error("Leave type not found")
  leaveTypes.splice(idx, 1)
  persistStore()
}

/**
 * الربط الآمن بالحضور: لكل يوم عمل في مدى طلب معتمد بلا سجل حضور،
 * إنشاء سجل on_leave — لا يعدّل أي سجل قائم أبدًا. فعل صريح من
 * المستخدم؛ يعيد عدد السجلات المُنشأة.
 */
export async function applyLeaveToAttendance(requestId: UUID): Promise<number> {
  await delay(340)
  const request = leaveRequests.find((r) => r.id === requestId)
  if (!request) throw new Error("Leave request not found")
  if (request.status !== "approved") {
    throw new Error("Only approved requests can be synced to attendance")
  }
  let created = 0
  for (const date of eachDateInRange(request.start_date, request.end_date)) {
    if (!isLeaveWorkDay(date, attendanceSettings.work_days)) continue
    const exists = attendanceHistory.some(
      (r) => r.employee_id === request.employee_id && r.date === date,
    )
    if (exists) continue // سجل قائم → يُتجاهل (لا تعديل إطلاقًا)
    const employee = employees.find((x) => x.id === request.employee_id)
    attendanceHistory.unshift({
      id: `att-leave-${Date.now() % 100000}-${created}`,
      tenant_id: TENANT,
      employee_id: request.employee_id,
      employee_name: employee?.full_name ?? "—",
      department_id: employee?.department_id ?? "",
      date,
      check_in: null,
      check_out: null,
      status: "on_leave",
      note: "إجازة معتمدة",
    })
    created += 1
  }
  if (created > 0) persistStore()
  return created
}

// ─── التعديل ─────────────────────────────────────────────────────────────────

export async function updateEmployee(
  id: UUID,
  input: UpdateEmployeeInput,
): Promise<Employee> {
  await delay(380)
  const employee = employees.find((x) => x.id === id)
  if (!employee) throw new Error("Employee not found")
  Object.assign(employee, {
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    job_title: input.job_title,
    department_id: input.department_id,
    position_id: input.position_id,
    hire_date: input.hire_date,
    salary: input.salary,
    status: input.status,
    updated_at: now,
  })
  persistStore()
  return { ...employee }
}

export async function updateDepartment(
  id: UUID,
  input: UpdateDepartmentInput,
): Promise<Department> {
  await delay(300)
  const department = departments.find((x) => x.id === id)
  if (!department) throw new Error("Department not found")
  Object.assign(department, {
    name: input.name,
    code: input.code.toUpperCase(),
    manager_name: input.manager_name,
    updated_at: now,
  })
  persistStore()
  return { ...department }
}

export async function updatePosition(
  id: UUID,
  input: UpdatePositionInput,
): Promise<Position> {
  await delay(300)
  const position = positions.find((x) => x.id === id)
  if (!position) throw new Error("Position not found")
  Object.assign(position, {
    code: input.code.toUpperCase(),
    title: input.title,
    department_id: input.department_id,
    updated_at: now,
  })
  persistStore()
  return { ...position }
}

// ─── الحذف ───────────────────────────────────────────────────────────────────

export async function deleteDepartment(id: UUID): Promise<void> {
  await delay(280)
  const hasEmployees = employees.some((x) => x.department_id === id)
  if (hasEmployees) {
    throw new Error("Department has employees")
  }
  const idx = departments.findIndex((x) => x.id === id)
  if (idx === -1) throw new Error("Department not found")
  departments.splice(idx, 1)
  persistStore()
}

export async function deletePosition(id: UUID): Promise<void> {
  await delay(280)
  // تصفير المرجع عند الموظفين (يطابق on delete set null)
  for (const employee of employees) {
    if (employee.position_id === id) {
      employee.position_id = null
      employee.updated_at = now
    }
  }
  const idx = positions.findIndex((x) => x.id === id)
  if (idx === -1) throw new Error("Position not found")
  positions.splice(idx, 1)
  persistStore()
}

// ─── الحضور: القراءة والإدارة (نفس عقد CompanyApi الموحد) ────────────────────

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
  await delay(320)
  return attendanceHistory.map((r) => ({ ...r }))
}

export async function fetchAttendanceSettings(): Promise<AttendanceSettings> {
  await delay(220)
  return { ...attendanceSettings }
}

export async function updateAttendanceSettings(
  input: UpdateAttendanceSettingsInput,
): Promise<AttendanceSettings> {
  await delay(300)
  attendanceSettings = {
    ...attendanceSettings,
    ...input,
    tenant_id: TENANT, // معرف الشركة لا يُعدَّل من المدخل
  }
  persistStore()
  return { ...attendanceSettings }
}

export async function createAttendance(
  input: CreateAttendanceInput,
): Promise<AttendanceRecord> {
  await delay(380)
  const exists = attendanceHistory.some(
    (r) => r.employee_id === input.employee_id && r.date === input.date,
  )
  if (exists) throw new Error("Attendance record already exists")
  const employee = employees.find((x) => x.id === input.employee_id)
  const record: AttendanceRecord = {
    id: `att-manual-${Date.now() % 100000}`,
    tenant_id: TENANT,
    employee_id: input.employee_id,
    employee_name: employee?.full_name ?? "—",
    department_id: employee?.department_id ?? "",
    date: input.date,
    check_in: input.check_in,
    check_out: input.check_out,
    status: input.status,
    note: input.note,
  }
  attendanceHistory.unshift(record)
  persistStore()
  return { ...record }
}

export async function updateAttendance(
  id: UUID,
  input: UpdateAttendanceInput,
): Promise<AttendanceRecord> {
  await delay(340)
  const record = attendanceHistory.find((r) => r.id === id)
  if (!record) throw new Error("Attendance record not found")
  const conflict = attendanceHistory.some(
    (r) =>
      r.id !== id &&
      r.employee_id === input.employee_id &&
      r.date === input.date,
  )
  if (conflict) throw new Error("Attendance record already exists")
  Object.assign(record, {
    employee_id: input.employee_id,
    date: input.date,
    check_in: input.check_in,
    check_out: input.check_out,
    status: input.status,
    note: input.note,
  })
  persistStore()
  return { ...record }
}

export async function deleteAttendance(id: UUID): Promise<void> {
  await delay(280)
  const idx = attendanceHistory.findIndex((r) => r.id === id)
  if (idx === -1) throw new Error("Attendance record not found")
  attendanceHistory.splice(idx, 1)
  persistStore()
}

export async function checkInEmployee(
  employeeId: UUID,
): Promise<AttendanceRecord> {
  await delay(300)
  const todayStr = localToday()
  const nowTime = localNowTime()
  const existing = attendanceHistory.find(
    (r) => r.employee_id === employeeId && r.date === todayStr,
  )

  if (existing) {
    if (existing.check_in) {
      throw new Error("Already checked in today")
    }
    // سجل اليوم بلا حضور (غائب/إجازة) → حضور الآن + اشتقاق الحالة من جديد
    Object.assign(existing, {
      check_in: nowTime,
      check_out: null,
      status: deriveCheckInStatus(nowTime, attendanceSettings),
    })
    persistStore()
    return { ...existing }
  }

  // لا سجل لليوم → إنشاء سجل جديد بحضور الآن
  const employee = employees.find((x) => x.id === employeeId)
  const record: AttendanceRecord = {
    id: `att-checkin-${Date.now() % 100000}`,
    tenant_id: TENANT,
    employee_id: employeeId,
    employee_name: employee?.full_name ?? "—",
    department_id: employee?.department_id ?? "",
    date: todayStr,
    check_in: nowTime,
    check_out: null,
    status: deriveCheckInStatus(nowTime, attendanceSettings),
    note: null,
  }
  attendanceHistory.unshift(record)
  persistStore()
  return { ...record }
}

export async function checkOutEmployee(
  employeeId: UUID,
): Promise<AttendanceRecord> {
  await delay(300)
  const todayStr = localToday()
  const nowTime = localNowTime()
  const existing = attendanceHistory.find(
    (r) => r.employee_id === employeeId && r.date === todayStr,
  )

  if (!existing || !existing.check_in) {
    throw new Error("No check-in today")
  }
  if (existing.check_out) {
    throw new Error("Already checked out")
  }

  existing.check_out = nowTime
  persistStore()
  return { ...existing }
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
