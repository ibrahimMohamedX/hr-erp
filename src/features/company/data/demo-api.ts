/**
 * Demo Company API — لف mock-db الموسّع بنفس عقود CompanyApi 1:1.
 * الثبات عبر sessionStorage (نفس نمط platform mock-db) — انظر mock-db.ts.
 */

import type { CompanyApi } from "./company-api"
import * as db from "./mock-db"

export const demoCompanyApi: CompanyApi = {
  mode: "demo",

  listEmployees: db.fetchEmployees,
  getEmployee: db.fetchEmployee,
  createEmployee: db.createEmployee,
  updateEmployee: db.updateEmployee,

  listDepartments: db.fetchDepartments,
  createDepartment: db.createDepartment,
  updateDepartment: db.updateDepartment,
  deleteDepartment: db.deleteDepartment,

  listPositions: db.fetchPositions,
  createPosition: db.createPosition,
  updatePosition: db.updatePosition,
  deletePosition: db.deletePosition,

  listAttendance: db.fetchAttendance,
  createAttendance: db.createAttendance,
  updateAttendance: db.updateAttendance,
  deleteAttendance: db.deleteAttendance,
  checkIn: db.checkInEmployee,
  checkOut: db.checkOutEmployee,
  getAttendanceSettings: db.fetchAttendanceSettings,
  updateAttendanceSettings: db.updateAttendanceSettings,

  listLeaveTypes: db.fetchLeaveTypes,
  createLeaveType: db.createLeaveType,
  updateLeaveType: db.updateLeaveType,
  deleteLeaveType: db.deleteLeaveType,
  listLeaveRequests: db.fetchLeaveRequests,
  createLeaveRequest: db.createLeaveRequest,
  updateLeaveRequest: db.updateLeaveRequest,
  cancelLeaveRequest: db.cancelLeaveRequest,
  approveLeaveRequest: db.approveLeaveRequest,
  rejectLeaveRequest: db.rejectLeaveRequest,
  applyLeaveToAttendance: db.applyLeaveToAttendance,
}
