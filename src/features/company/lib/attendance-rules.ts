/**
 * محرك قواعد الحضور — دوال نقية بلا أي حالة أو آثار جانبية.
 *
 * المصدر الوحيد لكل حسابات الحضور: live-api و demo-api وواجهات
 * الحضور تستدعي هذه الدوال معًا — لا يُكرَّر منطق الحساب في أي
 * مكان آخر مهما كان الوضع (live/demo).
 *
 * الاصطلاحات:
 *  - TimeClock = "HH:MM" (24 ساعة)
 *  - work_days باصطلاح getDay: 0=الأحد … 6=السبت
 *  - كل التواريخ ISODate = "YYYY-MM-DD"
 */

import type { AttendanceSettings, ISODate, TimeClock } from "@/types"

/** الإعدادات الافتراضية — تُستخدم عند غياب صف الإعدادات في الشركة */
export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  tenant_id: "default",
  work_start: "09:00",
  work_end: "17:00",
  late_grace_minutes: 15,
  work_days: [0, 1, 2, 3, 4],
  overtime_enabled: false,
}

/** "09:24" → 564 دقيقة من منتصف الليل */
export function timeToMinutes(t: TimeClock): number {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

/** 564 → "09:24" (تُقيد الدقائق داخل اليوم 0–1439) */
export function minutesToTime(m: number): TimeClock {
  const clamped = ((m % 1440) + 1440) % 1440
  const h = Math.floor(clamped / 60)
  const mm = clamped % 60
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}

/** دقائق العمل الفعلية = الانصراف − الحضور */
export function computeWorkedMinutes(
  checkIn: TimeClock,
  checkOut: TimeClock,
): number {
  return timeToMinutes(checkOut) - timeToMinutes(checkIn)
}

/** دقائق التأخير = max(0, الحضور − (بداية الدوام + مدة السماح)) */
export function computeLateMinutes(
  checkIn: TimeClock,
  settings: AttendanceSettings,
): number {
  const threshold =
    timeToMinutes(settings.work_start) + settings.late_grace_minutes
  return Math.max(0, timeToMinutes(checkIn) - threshold)
}

/** اشتقاق حالة الحضور من وقت الوصول: متأخر فقط لو تجاوز دقائق التأخير */
export function deriveCheckInStatus(
  checkIn: TimeClock,
  settings: AttendanceSettings,
): "present" | "late" {
  return computeLateMinutes(checkIn, settings) > 0 ? "late" : "present"
}

/**
 * هل التاريخ يوم عمل حسب أيام العمل الأسبوعية؟ (getDay: 0=الأحد … 6=السبت)
 * ⚠️ نُفكك المكونات ونستخدم المُنشئ المحلي — سلسلة "YYYY-MM-DD" عبر
 * new Date(date) تُفسَّر كـ UTC midnight، وgetDay() المحلي في المناطق
 * السالبة عن UTC كان سيعيد يومًا منزيحًا (خطأ). المُنشئ المحلي (y, m-1, d)
 * يضمن مطابقة اليوم المقصود في أي منطقة زمنية.
 */
export function isWorkDay(
  date: ISODate,
  settings: AttendanceSettings,
): boolean {
  const [y, m, d] = date.split("-").map(Number)
  const day = new Date(y, m - 1, d).getDay()
  return settings.work_days.includes(day)
}

/** تاريخ اليوم المحلي بمنطقة المتصفح — "YYYY-MM-DD" */
export function localToday(): ISODate {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

/** الوقت المحلي الآن بمنطقة المتصفح — "HH:MM" */
export function localNowTime(): TimeClock {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`
}
