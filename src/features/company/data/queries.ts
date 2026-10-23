/**
 * Query Hooks لمنطقة الشركة — TanStack Query فوق CompanyApi الموحد.
 *
 * Employees / Departments / Positions / Attendance / Leaves كلها تمر عبر
 * getCompanyApi() (live أو demo تلقائيًا حسب appEnv.companyMode).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

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

import { getCompanyApi } from "./company-api"
import { localToday } from "../lib/attendance-rules"

const api = () => getCompanyApi()

const keys = {
  departments: ["company", "departments"] as const,
  department: (id: string) => ["company", "departments", id] as const,
  employees: ["company", "employees"] as const,
  employee: (id: string) => ["company", "employees", id] as const,
  positions: ["company", "positions"] as const,
  attendance: ["company", "attendance"] as const,
  attendanceSettings: ["company", "attendance-settings"] as const,
  leaves: ["company", "leaves"] as const,
  leaveTypes: ["company", "leave-types"] as const,
}

// ─── Queries ────────────────────────────────────────────────────────────────

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: keys.departments,
    queryFn: () => api().listDepartments(),
  })
}

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: keys.employees,
    queryFn: () => api().listEmployees(),
  })
}

export function useEmployee(id: UUID) {
  return useQuery<Employee | null>({
    queryKey: keys.employee(id),
    queryFn: () => api().getEmployee(id),
    enabled: Boolean(id),
  })
}

export function usePositions() {
  return useQuery<Position[]>({
    queryKey: keys.positions,
    queryFn: () => api().listPositions(),
  })
}

/** السجل الكامل للحضور (اليوم أولًا ثم التاريخي) */
export function useAttendance() {
  return useQuery<AttendanceRecord[]>({
    queryKey: keys.attendance,
    queryFn: () => api().listAttendance(),
  })
}

/**
 * حضور اليوم فقط — نفس الاسم القديم كي لا تنكسر صفحة الحضور الحالية
 * قبل أن يعيد الوكيل C كتابتها: يشترك في نفس queryKey للسجل الكامل
 * ويفلتر اليوم client-side (يعمل الآن live أيضًا بدل demo فقط).
 */
export function useAttendanceToday() {
  return useQuery<AttendanceRecord[], AttendanceRecord[]>({
    queryKey: keys.attendance,
    queryFn: () => api().listAttendance(),
    select: (records) => records.filter((r) => r.date === localToday()),
  })
}

/** إعدادات قواعد الحضور (الافتراضات عند غياب صف مخصص) */
export function useAttendanceSettings() {
  return useQuery<AttendanceSettings>({
    queryKey: keys.attendanceSettings,
    queryFn: () => api().getAttendanceSettings(),
  })
}

export function useLeaveRequests() {
  return useQuery<LeaveRequest[]>({
    queryKey: keys.leaves,
    queryFn: () => api().listLeaveRequests(),
  })
}

/** أنواع الإجازات القابلة للتهيئة — دليل الشركة (hr_leave_types) */
export function useLeaveTypes() {
  return useQuery<LeaveTypeDefinition[]>({
    queryKey: keys.leaveTypes,
    queryFn: () => api().listLeaveTypes(),
  })
}

// ─── Mutations: الموظفون ───────────────────────────────────────────────────

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => api().createEmployee(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Employee[]>(keys.employees, (old) =>
        [...(old ?? []), created].sort((a, b) =>
          a.employee_code.localeCompare(b.employee_code),
        ),
      )
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateEmployeeInput }) =>
      api().updateEmployee(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Employee | null>(keys.employee(updated.id), updated)
      queryClient.setQueryData<Employee[]>(keys.employees, (old) =>
        (old ?? []).map((e) => (e.id === updated.id ? updated : e)),
      )
    },
  })
}

// ─── Mutations: الإدارات ───────────────────────────────────────────────────

export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => api().createDepartment(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Department[]>(keys.departments, (old) => [
        ...(old ?? []),
        created,
      ])
    },
  })
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateDepartmentInput }) =>
      api().updateDepartment(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Department[]>(keys.departments, (old) =>
        (old ?? []).map((d) => (d.id === updated.id ? updated : d)),
      )
    },
  })
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: UUID) => api().deleteDepartment(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<Department[]>(keys.departments, (old) =>
        (old ?? []).filter((d) => d.id !== id),
      )
    },
  })
}

// ─── Mutations: المناصب ─────────────────────────────────────────────────────

export function useCreatePosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePositionInput) => api().createPosition(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Position[]>(keys.positions, (old) => [
        ...(old ?? []),
        created,
      ])
    },
  })
}

export function useUpdatePosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdatePositionInput }) =>
      api().updatePosition(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<Position[]>(keys.positions, (old) =>
        (old ?? []).map((p) => (p.id === updated.id ? updated : p)),
      )
    },
  })
}

export function useDeletePosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: UUID) => api().deletePosition(id),
    onSuccess: (_, id) => {
      // إزالة المنصب + إبطال الموظفين (position_id قد تُصفَّر)
      queryClient.setQueryData<Position[]>(keys.positions, (old) =>
        (old ?? []).filter((p) => p.id !== id),
      )
      queryClient.invalidateQueries({ queryKey: keys.employees })
    },
  })
}

// ─── Mutations: الحضور ─────────────────────────────────────────────────────

export function useCreateAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateAttendanceInput) =>
      api().createAttendance(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

export function useUpdateAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateAttendanceInput }) =>
      api().updateAttendance(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: UUID) => api().deleteAttendance(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

export function useCheckIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (employeeId: UUID) => api().checkIn(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

export function useCheckOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (employeeId: UUID) => api().checkOut(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

export function useUpdateAttendanceSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateAttendanceSettingsInput) =>
      api().updateAttendanceSettings(input),
    onSuccess: (updated) => {
      // الإعدادات نفسها + السجل (القواعد تغيّرت فالحسابات المعروضة تتغير)
      queryClient.setQueryData<AttendanceSettings>(
        keys.attendanceSettings,
        updated,
      )
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

// ─── Mutations: الإجازات ───────────────────────────────────────────────────

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) =>
      api().createLeaveRequest(input),
    onSuccess: (created) => {
      queryClient.setQueryData<LeaveRequest[]>(keys.leaves, (old) => [
        created,
        ...(old ?? []),
      ])
    },
  })
}

export function useUpdateLeaveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateLeaveRequestInput }) =>
      api().updateLeaveRequest(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.leaves })
    },
  })
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: UUID) => api().cancelLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.leaves })
    },
  })
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: UUID) => api().approveLeaveRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.leaves })
    },
  })
}

export function useRejectLeaveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }: { id: UUID; reason: string }) =>
      api().rejectLeaveRequest(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.leaves })
    },
  })
}

/**
 * الربط الآمن بالحضور — يبطل الإجازات والحضور معًا لأنه يُنشئ
 * سجلات on_leave جديدة لأيام بلا سجل قائم.
 */
export function useApplyLeaveToAttendance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (requestId: UUID) => api().applyLeaveToAttendance(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.leaves })
      queryClient.invalidateQueries({ queryKey: keys.attendance })
    },
  })
}

// ─── Mutations: أنواع الإجازات ─────────────────────────────────────────────

export function useCreateLeaveType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateLeaveTypeInput) => api().createLeaveType(input),
    onSuccess: (created) => {
      queryClient.setQueryData<LeaveTypeDefinition[]>(
        keys.leaveTypes,
        (old) => [...(old ?? []), created],
      )
    },
  })
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, input }: { id: UUID; input: UpdateLeaveTypeInput }) =>
      api().updateLeaveType(id, input),
    onSuccess: (updated) => {
      queryClient.setQueryData<LeaveTypeDefinition[]>(keys.leaveTypes, (old) =>
        (old ?? []).map((t) => (t.id === updated.id ? updated : t)),
      )
    },
  })
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: UUID) => api().deleteLeaveType(id),
    onSuccess: (_, id) => {
      queryClient.setQueryData<LeaveTypeDefinition[]>(keys.leaveTypes, (old) =>
        (old ?? []).filter((t) => t.id !== id),
      )
    },
  })
}
