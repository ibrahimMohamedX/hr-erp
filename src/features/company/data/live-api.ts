/**
 * Live Company API — تنفيذ فوق مشروع Supabase الحقيقي للشركة.
 *
 * الجداول: hr_employees · hr_departments · hr_positions · hr_attendance ·
 * hr_attendance_settings · hr_leave_types · hr_leave_requests
 * العزل فيزيائي (DB-per-tenant) — لا tenant_id في الجداول؛
 * الـ mapper يضبط tenant_id بقيمة عرض فقط "live".
 *
 * ⚠️ لا مفاتيح/أسرار هنا — العميل (anon key عبر env) موجود بالفعل.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

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
import type { CompanyApi } from "./company-api"
import { getSupabaseClient } from "@/lib/supabase/client"
import {
  DEFAULT_ATTENDANCE_SETTINGS,
  deriveCheckInStatus,
  localNowTime,
  localToday,
} from "../lib/attendance-rules"
import {
  eachDateInRange,
  isLeaveWorkDay,
  validateLeaveWindow,
} from "../lib/leave-rules"

// ─── Mappers: صف → نوع الواجهة ─────────────────────────────────────────────

/** tenant_id في وضع live قيمة عرض فقط — العزل فيزيائي */
const LIVE_TENANT = "live"

interface EmployeeRow {
  id: string
  employee_code: string
  full_name: string
  email: string
  phone: string | null
  job_title: string
  department_id: string
  position_id: string | null
  hire_date: string
  salary: number | null
  status: string
  created_at: string
  updated_at: string
}

interface DepartmentRow {
  id: string
  name: string
  code: string
  manager_name: string | null
  created_at: string
  updated_at: string
}

interface PositionRow {
  id: string
  code: string
  title: string
  department_id: string | null
  created_at: string
  updated_at: string
}

function rowToEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    employee_code: row.employee_code,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    job_title: row.job_title,
    department_id: row.department_id,
    position_id: row.position_id,
    hire_date: row.hire_date,
    salary: row.salary,
    status: row.status as Employee["status"],
    tenant_id: LIVE_TENANT,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToDepartment(row: DepartmentRow): Department {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    manager_name: row.manager_name,
    tenant_id: LIVE_TENANT,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function rowToPosition(row: PositionRow): Position {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    department_id: row.department_id,
    tenant_id: LIVE_TENANT,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

// ─── Mappers: الحضور ───────────────────────────────────────────────────────

/** صف hr_attendance مع الموظف المضمّن (select("*, hr_employees(...)")) */
interface AttendanceRow {
  id: string
  employee_id: string
  work_date: string
  check_in: string | null
  check_out: string | null
  status: string
  note: string | null
  hr_employees: { full_name: string | null; department_id: string | null } | null
}

/** صف hr_attendance_settings */
interface AttendanceSettingsRow {
  id: string
  work_start: string
  work_end: string
  late_grace_minutes: number
  work_days: number[] | null
  overtime_enabled: boolean | null
}

/** Postgres time يرجع "08:52:00" — نطبّعه إلى HH:MM في كل قراءة */
function normalizeTime(t: string | null): string | null {
  return t ? t.slice(0, 5) : null
}

function rowToAttendance(row: AttendanceRow): AttendanceRecord {
  return {
    id: row.id,
    tenant_id: LIVE_TENANT,
    employee_id: row.employee_id,
    employee_name: row.hr_employees?.full_name ?? "—",
    department_id: row.hr_employees?.department_id ?? "",
    date: row.work_date,
    check_in: normalizeTime(row.check_in),
    check_out: normalizeTime(row.check_out),
    status: row.status as AttendanceRecord["status"],
    note: row.note,
  }
}

function mapSettingsRow(row: AttendanceSettingsRow): AttendanceSettings {
  return {
    tenant_id: LIVE_TENANT,
    work_start: normalizeTime(row.work_start) ?? DEFAULT_ATTENDANCE_SETTINGS.work_start,
    work_end: normalizeTime(row.work_end) ?? DEFAULT_ATTENDANCE_SETTINGS.work_end,
    late_grace_minutes: row.late_grace_minutes,
    work_days: row.work_days ?? DEFAULT_ATTENDANCE_SETTINGS.work_days,
    overtime_enabled: row.overtime_enabled ?? false,
  }
}

// ─── Mappers: الإجازات ─────────────────────────────────────────────────────

/** صف hr_leave_types */
interface LeaveTypeRow {
  id: string
  name: string
  description: string | null
  annual_days: number | null
  is_paid: boolean | null
  is_active: boolean | null
  created_at: string
}

/** صف hr_leave_requests مع الموظف والنوع المضمّنين (select("*, ...")) */
interface LeaveRequestRow {
  id: string
  employee_id: string
  leave_type_id: string
  start_date: string
  end_date: string
  days: number
  reason: string | null
  status: string
  rejection_reason: string | null
  decided_by: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
  hr_employees: { full_name: string | null } | null
  hr_leave_types: { name: string | null } | null
}

function rowToLeaveType(row: LeaveTypeRow): LeaveTypeDefinition {
  return {
    id: row.id,
    tenant_id: LIVE_TENANT,
    name: row.name,
    description: row.description,
    annual_days: row.annual_days,
    is_paid: row.is_paid ?? true,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
  }
}

function rowToLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    tenant_id: LIVE_TENANT,
    employee_id: row.employee_id,
    employee_name: row.hr_employees?.full_name ?? "—",
    leave_type_id: row.leave_type_id,
    leave_type_name: row.hr_leave_types?.name ?? "—",
    start_date: row.start_date,
    end_date: row.end_date,
    days: row.days,
    reason: row.reason,
    status: row.status as LeaveRequest["status"],
    rejection_reason: row.rejection_reason,
    decided_by: row.decided_by,
    decided_at: row.decided_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * خرائط قيود hr_leave_requests (check constraints — 23514) إلى رسائل
 * العقد — خط دفاع خلفي فقط: التحقق الفعلي يجري قبل الكتابة عبر
 * محرك leave-rules في كلا الوضعين بنفس النصوص.
 */
function mapLeaveCheckViolation(error: {
  code?: string
  message: string
}): string | null {
  if (error.code === "23514" || /check constraint/i.test(error.message)) {
    if (/end_date/i.test(error.message)) return "End date before start date"
    if (/days/i.test(error.message)) return "No working days in range"
  }
  return null
}

/**
 * هل الخطأ «الجدول غير موجود»؟ (لم تُطبق migration بعد)
 * PGRST205 من PostgREST أو رسائل الشائعة المكافئة.
 * في listAttendance/getAttendanceSettings نعاملها كحالة «غير مهيأ»
 * صريحة — ليست بيانات وهمية — والواجهة تعرض تنبيهًا واضحًا.
 */
function isMissingTable(error: { code?: string; message: string } | null): boolean {
  if (!error) return false
  return (
    error.code === "PGRST205" ||
    /does not exist|Could not find the table|schema cache/i.test(error.message)
  )
}

/** سجل حضور اليوم لموظف — null لو لا سجل */
async function findTodayRecord(
  client: SupabaseClient,
  employeeId: UUID,
): Promise<AttendanceRow | null> {
  const { data, error } = await client
    .from("hr_attendance")
    .select("*, hr_employees(full_name, department_id)")
    .eq("employee_id", employeeId)
    .eq("work_date", localToday())
    .maybeSingle()
  throwIfError(error, "hr_attendance", "find today")
  return (data as unknown as AttendanceRow) ?? null
}

/** معالجة خطأ Supabase → Error برسالة مفهومة مع اسم الجدول */
function throwIfError(error: { message: string } | null, table: string, op: string): void {
  if (error) {
    throw new Error(`[${table}] ${op} failed: ${error.message}`)
  }
}

// ─── التنفيذ ───────────────────────────────────────────────────────────────

export const liveCompanyApi: CompanyApi = {
  mode: "live",

  async listEmployees(): Promise<Employee[]> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_employees")
      .select("*")
      .order("employee_code", { ascending: true })
    throwIfError(error, "hr_employees", "list")
    return (data as unknown as EmployeeRow[]).map(rowToEmployee)
  },

  async getEmployee(id: UUID): Promise<Employee | null> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_employees")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    throwIfError(error, "hr_employees", "get")
    return data ? rowToEmployee(data as unknown as EmployeeRow) : null
  },

  async createEmployee(input: CreateEmployeeInput): Promise<Employee> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_employees")
      .insert({
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        job_title: input.job_title,
        department_id: input.department_id,
        position_id: input.position_id,
        hire_date: input.hire_date,
        salary: input.salary,
        status: input.status,
      })
      .select("*")
      .single()
    throwIfError(error, "hr_employees", "create")
    return rowToEmployee(data as unknown as EmployeeRow)
  },

  async updateEmployee(id: UUID, input: UpdateEmployeeInput): Promise<Employee> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_employees")
      .update({
        full_name: input.full_name,
        email: input.email,
        phone: input.phone,
        job_title: input.job_title,
        department_id: input.department_id,
        position_id: input.position_id,
        hire_date: input.hire_date,
        salary: input.salary,
        status: input.status,
      })
      .eq("id", id)
      .select("*")
      .single()
    throwIfError(error, "hr_employees", "update")
    return rowToEmployee(data as unknown as EmployeeRow)
  },

  async listDepartments(): Promise<Department[]> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_departments")
      .select("*")
      .order("name", { ascending: true })
    throwIfError(error, "hr_departments", "list")
    return (data as unknown as DepartmentRow[]).map(rowToDepartment)
  },

  async createDepartment(input: CreateDepartmentInput): Promise<Department> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_departments")
      .insert({
        name: input.name,
        code: input.code.toUpperCase(),
        manager_name: input.manager_name,
      })
      .select("*")
      .single()
    throwIfError(error, "hr_departments", "create")
    return rowToDepartment(data as unknown as DepartmentRow)
  },

  async updateDepartment(id: UUID, input: UpdateDepartmentInput): Promise<Department> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_departments")
      .update({
        name: input.name,
        code: input.code.toUpperCase(),
        manager_name: input.manager_name,
      })
      .eq("id", id)
      .select("*")
      .single()
    throwIfError(error, "hr_departments", "update")
    return rowToDepartment(data as unknown as DepartmentRow)
  },

  async deleteDepartment(id: UUID): Promise<void> {
    const client = getSupabaseClient()
    const { error } = await client
      .from("hr_departments")
      .delete()
      .eq("id", id)
    if (error) {
      // on delete restrict: القسم به موظفون — نوحّد رسالة العقد مع demo
      // (code 23503 = FK violation من Postgres)
      if (error.code === "23503" || /violates foreign key/i.test(error.message)) {
        throw new Error("Department has employees")
      }
      throw new Error(`[hr_departments] delete failed: ${error.message}`)
    }
  },

  async listPositions(): Promise<Position[]> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_positions")
      .select("*")
      .order("code", { ascending: true })
    throwIfError(error, "hr_positions", "list")
    return (data as unknown as PositionRow[]).map(rowToPosition)
  },

  async createPosition(input: CreatePositionInput): Promise<Position> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_positions")
      .insert({
        code: input.code.toUpperCase(),
        title: input.title,
        department_id: input.department_id,
      })
      .select("*")
      .single()
    throwIfError(error, "hr_positions", "create")
    return rowToPosition(data as unknown as PositionRow)
  },

  async updatePosition(id: UUID, input: UpdatePositionInput): Promise<Position> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_positions")
      .update({
        code: input.code.toUpperCase(),
        title: input.title,
        department_id: input.department_id,
      })
      .eq("id", id)
      .select("*")
      .single()
    throwIfError(error, "hr_positions", "update")
    return rowToPosition(data as unknown as PositionRow)
  },

  async deletePosition(id: UUID): Promise<void> {
    const client = getSupabaseClient()
    // تصفير المرجع عند الموظفين (يطابق on delete set null)
    const { error: clearErr } = await client
      .from("hr_employees")
      .update({ position_id: null })
      .eq("position_id", id)
    throwIfError(clearErr, "hr_employees", "clear position reference")

    const { error } = await client
      .from("hr_positions")
      .delete()
      .eq("id", id)
    throwIfError(error, "hr_positions", "delete")
  },

  // ─── الحضور والانصراف ─────────────────────────────────────────────────

  async listAttendance(): Promise<AttendanceRecord[]> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_attendance")
      .select("*, hr_employees(full_name, department_id)")
      .order("work_date", { ascending: false })
    // الجدول لم يُهيأ بعد (لم تُطبق migration) — حالة «غير مهيأ» صريحة:
    // إعادة [] ليست بيانات وهمية — الواجهة تعرض تنبيهًا بأن الوحدة غير مهيأة.
    if (isMissingTable(error)) return []
    throwIfError(error, "hr_attendance", "list")
    const rows = (data as unknown as AttendanceRow[]) ?? []
    // فرز JS ثابت: التاريخ الأحدث أولًا، وداخل نفس اليوم حسب employee_name
    return rows
      .map(rowToAttendance)
      .sort((a, b) =>
        a.date === b.date
          ? a.employee_name.localeCompare(b.employee_name, "ar")
          : a.date < b.date
            ? 1
            : -1,
      )
  },

  async createAttendance(input: CreateAttendanceInput): Promise<AttendanceRecord> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_attendance")
      .insert({
        employee_id: input.employee_id,
        work_date: input.date,
        check_in: input.check_in,
        check_out: input.check_out,
        status: input.status,
        note: input.note,
      })
      .select("*, hr_employees(full_name, department_id)")
      .single()
    if (error) {
      // unique(employee_id, work_date) — نوحّد رسالة العقد مع demo
      // (code 23505 = unique violation من Postgres)
      if (
        error.code === "23505" ||
        /duplicate key|unique constraint/i.test(error.message)
      ) {
        throw new Error("Attendance record already exists")
      }
      throw new Error(`[hr_attendance] create failed: ${error.message}`)
    }
    return rowToAttendance(data as unknown as AttendanceRow)
  },

  async updateAttendance(
    id: UUID,
    input: UpdateAttendanceInput,
  ): Promise<AttendanceRecord> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_attendance")
      .update({
        employee_id: input.employee_id,
        work_date: input.date,
        check_in: input.check_in,
        check_out: input.check_out,
        status: input.status,
        note: input.note,
      })
      .eq("id", id)
      .select("*, hr_employees(full_name, department_id)")
      .maybeSingle()
    if (error) {
      if (
        error.code === "23505" ||
        /duplicate key|unique constraint/i.test(error.message)
      ) {
        throw new Error("Attendance record already exists")
      }
      throw new Error(`[hr_attendance] update failed: ${error.message}`)
    }
    if (!data) throw new Error("Attendance record not found")
    return rowToAttendance(data as unknown as AttendanceRow)
  },

  async deleteAttendance(id: UUID): Promise<void> {
    const client = getSupabaseClient()
    // select للتفريق بين «حُذف» و«لم يوجد أصلًا»
    const { data, error } = await client
      .from("hr_attendance")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle()
    throwIfError(error, "hr_attendance", "delete")
    if (!data) throw new Error("Attendance record not found")
  },

  async checkIn(employeeId: UUID): Promise<AttendanceRecord> {
    const client = getSupabaseClient()
    const today = localToday()
    const nowTime = localNowTime()
    const existing = await findTodayRecord(client, employeeId)

    if (existing) {
      if (existing.check_in) {
        throw new Error("Already checked in today")
      }
      // سجل اليوم بلا حضور (غائب/إجازة) → حضور الآن + اشتقاق الحالة من جديد
      const settings = await liveCompanyApi.getAttendanceSettings()
      const status = deriveCheckInStatus(nowTime, settings)
      const { data, error } = await client
        .from("hr_attendance")
        .update({ check_in: nowTime, check_out: null, status })
        .eq("id", existing.id)
        .select("*, hr_employees(full_name, department_id)")
        .single()
      throwIfError(error, "hr_attendance", "check-in")
      return rowToAttendance(data as unknown as AttendanceRow)
    }

    // لا سجل لليوم → إنشاء سجل جديد بحضور الآن
    const settings = await liveCompanyApi.getAttendanceSettings()
    const status = deriveCheckInStatus(nowTime, settings)
    const { data, error } = await client
      .from("hr_attendance")
      .insert({
        employee_id: employeeId,
        work_date: today,
        check_in: nowTime,
        check_out: null,
        status,
        note: null,
      })
      .select("*, hr_employees(full_name, department_id)")
      .single()
    throwIfError(error, "hr_attendance", "check-in")
    return rowToAttendance(data as unknown as AttendanceRow)
  },

  async checkOut(employeeId: UUID): Promise<AttendanceRecord> {
    const client = getSupabaseClient()
    const nowTime = localNowTime()
    const existing = await findTodayRecord(client, employeeId)

    if (!existing || !existing.check_in) {
      throw new Error("No check-in today")
    }
    if (existing.check_out) {
      throw new Error("Already checked out")
    }

    const { data, error } = await client
      .from("hr_attendance")
      .update({ check_out: nowTime })
      .eq("id", existing.id)
      .select("*, hr_employees(full_name, department_id)")
      .single()
    throwIfError(error, "hr_attendance", "check-out")
    return rowToAttendance(data as unknown as AttendanceRow)
  },

  async getAttendanceSettings(): Promise<AttendanceSettings> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_attendance_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
    // الجدول لم يُهيأ بعد (لم تُطبق migration) — الافتراضات حالة
    // «غير مهيأ» صريحة، ليست بيانات وهمية — الواجهة تعرض تنبيهًا.
    if (isMissingTable(error)) {
      return { ...DEFAULT_ATTENDANCE_SETTINGS, tenant_id: LIVE_TENANT }
    }
    throwIfError(error, "hr_attendance_settings", "get")
    if (!data) {
      return { ...DEFAULT_ATTENDANCE_SETTINGS, tenant_id: LIVE_TENANT }
    }
    return mapSettingsRow(data as unknown as AttendanceSettingsRow)
  },

  async updateAttendanceSettings(
    input: UpdateAttendanceSettingsInput,
  ): Promise<AttendanceSettings> {
    const client = getSupabaseClient()
    const { data: existing, error: findErr } = await client
      .from("hr_attendance_settings")
      .select("id")
      .limit(1)
      .maybeSingle()
    throwIfError(findErr, "hr_attendance_settings", "find")

    if (existing) {
      // صف موجود → تحديثه
      const { data, error } = await client
        .from("hr_attendance_settings")
        .update({
          work_start: input.work_start,
          work_end: input.work_end,
          late_grace_minutes: input.late_grace_minutes,
          work_days: input.work_days,
          overtime_enabled: input.overtime_enabled,
        })
        .eq("id", (existing as { id: string }).id)
        .select("*")
        .single()
      throwIfError(error, "hr_attendance_settings", "update")
      return mapSettingsRow(data as unknown as AttendanceSettingsRow)
    }

    // لا صف → إنشاء (خطوتان: قراءة ثم إدراج — مقبول وفق العقد)
    const { data, error } = await client
      .from("hr_attendance_settings")
      .insert({
        work_start: input.work_start,
        work_end: input.work_end,
        late_grace_minutes: input.late_grace_minutes,
        work_days: input.work_days,
        overtime_enabled: input.overtime_enabled,
      })
      .select("*")
      .single()
    throwIfError(error, "hr_attendance_settings", "insert")
    return mapSettingsRow(data as unknown as AttendanceSettingsRow)
  },

  // ─── الإجازات: الأنواع ───────────────────────────────────────────────

  async listLeaveTypes(): Promise<LeaveTypeDefinition[]> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_leave_types")
      .select("*")
      .order("name", { ascending: true })
    // الجدول لم يُهيأ بعد (لم تُطبق migration) — حالة «غير مهيأ» صريحة:
    // إعادة [] ليست بيانات وهمية — الواجهة تعرض تنبيهًا بأن الوحدة غير مهيأة.
    if (isMissingTable(error)) return []
    throwIfError(error, "hr_leave_types", "list")
    return ((data as unknown as LeaveTypeRow[]) ?? []).map(rowToLeaveType)
  },

  async createLeaveType(input: CreateLeaveTypeInput): Promise<LeaveTypeDefinition> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_leave_types")
      .insert({
        name: input.name.trim(),
        description: input.description,
        annual_days: input.annual_days,
        is_paid: input.is_paid,
        is_active: input.is_active,
      })
      .select("*")
      .single()
    if (error) {
      // unique(name) — نوحّد رسالة العقد مع demo (code 23505)
      if (
        error.code === "23505" ||
        /duplicate key|unique constraint/i.test(error.message)
      ) {
        throw new Error("Leave type already exists")
      }
      throw new Error(`[hr_leave_types] create failed: ${error.message}`)
    }
    return rowToLeaveType(data as unknown as LeaveTypeRow)
  },

  async updateLeaveType(
    id: UUID,
    input: UpdateLeaveTypeInput,
  ): Promise<LeaveTypeDefinition> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_leave_types")
      .update({
        name: input.name.trim(),
        description: input.description,
        annual_days: input.annual_days,
        is_paid: input.is_paid,
        is_active: input.is_active,
      })
      .eq("id", id)
      .select("*")
      .maybeSingle()
    if (error) {
      if (
        error.code === "23505" ||
        /duplicate key|unique constraint/i.test(error.message)
      ) {
        throw new Error("Leave type already exists")
      }
      throw new Error(`[hr_leave_types] update failed: ${error.message}`)
    }
    if (!data) throw new Error("Leave type not found")
    return rowToLeaveType(data as unknown as LeaveTypeRow)
  },

  async deleteLeaveType(id: UUID): Promise<void> {
    const client = getSupabaseClient()
    // select للتفريق بين «حُذف» و«لم يوجد أصلًا»
    const { data, error } = await client
      .from("hr_leave_types")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle()
    if (error) {
      // on delete restrict: النوع له طلبات — نوحّد رسالة العقد مع demo
      // (code 23503 = FK violation من Postgres)
      if (
        error.code === "23503" ||
        /violates foreign key/i.test(error.message)
      ) {
        throw new Error("Leave type has requests")
      }
      throw new Error(`[hr_leave_types] delete failed: ${error.message}`)
    }
    if (!data) throw new Error("Leave type not found")
  },

  // ─── الإجازات: الطلبات ───────────────────────────────────────────────

  async listLeaveRequests(): Promise<LeaveRequest[]> {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from("hr_leave_requests")
      .select("*, hr_employees(full_name), hr_leave_types(name)")
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false })
    // الجدول لم يُهيأ بعد — حالة «غير مهيأ» صريحة (لا بيانات وهمية)
    if (isMissingTable(error)) return []
    throwIfError(error, "hr_leave_requests", "list")
    return ((data as unknown as LeaveRequestRow[]) ?? []).map(rowToLeaveRequest)
  },

  async createLeaveRequest(
    input: CreateLeaveRequestInput,
  ): Promise<LeaveRequest> {
    const client = getSupabaseClient()
    // التحقق الموحد قبل الكتابة: إعدادات الحضور (أيام العمل) + الأنواع + الطلبات
    const [settings, types, requests] = await Promise.all([
      liveCompanyApi.getAttendanceSettings(),
      liveCompanyApi.listLeaveTypes(),
      liveCompanyApi.listLeaveRequests(),
    ])
    const validation = validateLeaveWindow({
      requests,
      types,
      employeeId: input.employee_id,
      leaveTypeId: input.leave_type_id,
      start: input.start_date,
      end: input.end_date,
      workDays: settings.work_days,
    })
    if (validation.error) throw new Error(validation.error)
    const { data, error } = await client
      .from("hr_leave_requests")
      .insert({
        employee_id: input.employee_id,
        leave_type_id: input.leave_type_id,
        start_date: input.start_date,
        end_date: input.end_date,
        days: validation.days,
        reason: input.reason,
        status: "pending",
      })
      .select("*, hr_employees(full_name), hr_leave_types(name)")
      .single()
    if (error) {
      const mapped = mapLeaveCheckViolation(error)
      if (mapped) throw new Error(mapped)
      // FK على النوع/الموظف — لا يصل إليها مسار الواجهة الشرعي
      if (
        error.code === "23503" ||
        /violates foreign key/i.test(error.message)
      ) {
        throw new Error("Leave type not found")
      }
      throw new Error(`[hr_leave_requests] create failed: ${error.message}`)
    }
    return rowToLeaveRequest(data as unknown as LeaveRequestRow)
  },

  async updateLeaveRequest(
    id: UUID,
    input: UpdateLeaveRequestInput,
  ): Promise<LeaveRequest> {
    const client = getSupabaseClient()
    const { data: existing, error: findErr } = await client
      .from("hr_leave_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    throwIfError(findErr, "hr_leave_requests", "find")
    if (!existing) throw new Error("Leave request not found")
    if ((existing as { status: string }).status !== "pending") {
      throw new Error("Only pending requests can be modified")
    }
    const [settings, types, requests] = await Promise.all([
      liveCompanyApi.getAttendanceSettings(),
      liveCompanyApi.listLeaveTypes(),
      liveCompanyApi.listLeaveRequests(),
    ])
    const validation = validateLeaveWindow({
      requests,
      types,
      employeeId: input.employee_id,
      leaveTypeId: input.leave_type_id,
      start: input.start_date,
      end: input.end_date,
      workDays: settings.work_days,
      excludeId: id,
    })
    if (validation.error) throw new Error(validation.error)
    const { data, error } = await client
      .from("hr_leave_requests")
      .update({
        employee_id: input.employee_id,
        leave_type_id: input.leave_type_id,
        start_date: input.start_date,
        end_date: input.end_date,
        days: validation.days,
        reason: input.reason,
      })
      .eq("id", id)
      .select("*, hr_employees(full_name), hr_leave_types(name)")
      .single()
    if (error) {
      const mapped = mapLeaveCheckViolation(error)
      if (mapped) throw new Error(mapped)
      throw new Error(`[hr_leave_requests] update failed: ${error.message}`)
    }
    return rowToLeaveRequest(data as unknown as LeaveRequestRow)
  },

  async cancelLeaveRequest(id: UUID): Promise<LeaveRequest> {
    const client = getSupabaseClient()
    const { data: existing, error: findErr } = await client
      .from("hr_leave_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    throwIfError(findErr, "hr_leave_requests", "find")
    if (!existing) throw new Error("Leave request not found")
    const status = (existing as { status: string }).status
    if (status !== "pending" && status !== "approved") {
      throw new Error("Only pending or approved requests can be cancelled")
    }
    const { data, error } = await client
      .from("hr_leave_requests")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*, hr_employees(full_name), hr_leave_types(name)")
      .single()
    throwIfError(error, "hr_leave_requests", "cancel")
    return rowToLeaveRequest(data as unknown as LeaveRequestRow)
  },

  async approveLeaveRequest(id: UUID): Promise<LeaveRequest> {
    const client = getSupabaseClient()
    const { data: existing, error: findErr } = await client
      .from("hr_leave_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    throwIfError(findErr, "hr_leave_requests", "find")
    if (!existing) throw new Error("Leave request not found")
    if ((existing as { status: string }).status !== "pending") {
      throw new Error("Only pending requests can be decided")
    }
    // من قرر: uuid مستخدم الجلسة الحالي — الأثر التدقيقي مع decided_at
    const { data: userData } = await client.auth.getUser()
    const decidedBy = userData.user?.id ?? null
    const { data, error } = await client
      .from("hr_leave_requests")
      .update({
        status: "approved",
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, hr_employees(full_name), hr_leave_types(name)")
      .single()
    throwIfError(error, "hr_leave_requests", "approve")
    return rowToLeaveRequest(data as unknown as LeaveRequestRow)
  },

  async rejectLeaveRequest(id: UUID, reason: string): Promise<LeaveRequest> {
    const trimmed = reason.trim()
    if (!trimmed) throw new Error("Rejection reason is required")
    const client = getSupabaseClient()
    const { data: existing, error: findErr } = await client
      .from("hr_leave_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    throwIfError(findErr, "hr_leave_requests", "find")
    if (!existing) throw new Error("Leave request not found")
    if ((existing as { status: string }).status !== "pending") {
      throw new Error("Only pending requests can be decided")
    }
    const { data: userData } = await client.auth.getUser()
    const decidedBy = userData.user?.id ?? null
    const { data, error } = await client
      .from("hr_leave_requests")
      .update({
        status: "rejected",
        rejection_reason: trimmed,
        decided_by: decidedBy,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*, hr_employees(full_name), hr_leave_types(name)")
      .single()
    throwIfError(error, "hr_leave_requests", "reject")
    return rowToLeaveRequest(data as unknown as LeaveRequestRow)
  },

  async applyLeaveToAttendance(requestId: UUID): Promise<number> {
    const client = getSupabaseClient()
    const { data: existing, error: findErr } = await client
      .from("hr_leave_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle()
    throwIfError(findErr, "hr_leave_requests", "find")
    if (!existing) throw new Error("Leave request not found")
    const request = rowToLeaveRequest(existing as unknown as LeaveRequestRow)
    if (request.status !== "approved") {
      throw new Error("Only approved requests can be synced to attendance")
    }
    const settings = await liveCompanyApi.getAttendanceSettings()
    // سجلات الحضور القائمة للموظف داخل المدى — لا يعدّل أيًا منها أبدًا
    const { data: existingRows, error: attErr } = await client
      .from("hr_attendance")
      .select("work_date")
      .eq("employee_id", request.employee_id)
      .gte("work_date", request.start_date)
      .lte("work_date", request.end_date)
    throwIfError(attErr, "hr_attendance", "list for sync")
    const takenDates = new Set(
      (
        (existingRows as unknown as Array<{ work_date: string }>) ?? []
      ).map((r) => r.work_date),
    )
    let created = 0
    for (const date of eachDateInRange(request.start_date, request.end_date)) {
      if (!isLeaveWorkDay(date, settings.work_days)) continue
      if (takenDates.has(date)) continue // سجل قائم → يُتجاهل (لا تعديل)
      const { error: insertErr } = await client.from("hr_attendance").insert({
        employee_id: request.employee_id,
        work_date: date,
        check_in: null,
        check_out: null,
        status: "on_leave",
        note: "إجازة معتمدة",
      })
      throwIfError(insertErr, "hr_attendance", "sync on_leave")
      created += 1
    }
    return created
  },
}
