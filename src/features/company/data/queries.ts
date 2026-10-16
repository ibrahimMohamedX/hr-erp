/**
 * Query Hooks لمنطقة الشركة — TanStack Query فوق المتجر التجريبي.
 * عند الربط الفعلي: يستبدل جسم queryFn/mutationFn فقط باستدعاءات Supabase.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type {
  AttendanceRecord,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateLeaveRequestInput,
  Department,
  Employee,
  LeaveRequest,
} from "@/types"

import {
  createDepartment,
  createEmployee,
  createLeaveRequest,
  fetchAttendanceToday,
  fetchDepartments,
  fetchEmployees,
  fetchLeaveRequests,
} from "./mock-db"

const keys = {
  departments: ["company", "departments"] as const,
  employees: ["company", "employees"] as const,
  attendance: ["company", "attendance", "today"] as const,
  leaves: ["company", "leaves"] as const,
}

export function useDepartments() {
  return useQuery<Department[]>({
    queryKey: keys.departments,
    queryFn: fetchDepartments,
  })
}

export function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: keys.employees,
    queryFn: fetchEmployees,
  })
}

export function useAttendanceToday() {
  return useQuery<AttendanceRecord[]>({
    queryKey: keys.attendance,
    queryFn: fetchAttendanceToday,
  })
}

export function useLeaveRequests() {
  return useQuery<LeaveRequest[]>({
    queryKey: keys.leaves,
    queryFn: fetchLeaveRequests,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Employee[]>(keys.employees, (old) =>
        [...(old ?? []), created].sort((a, b) =>
          a.employee_code.localeCompare(b.employee_code),
        ),
      )
    },
  })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => createDepartment(input),
    onSuccess: (created) => {
      queryClient.setQueryData<Department[]>(keys.departments, (old) => [
        ...(old ?? []),
        created,
      ])
    },
  })
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => createLeaveRequest(input),
    onSuccess: (created) => {
      queryClient.setQueryData<LeaveRequest[]>(keys.leaves, (old) => [
        created,
        ...(old ?? []),
      ])
    },
  })
}
