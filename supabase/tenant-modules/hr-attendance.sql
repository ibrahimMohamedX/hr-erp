-- ═══════════════════════════════════════════════════════════════════════════
-- Attendance Module Schema — جداول الحضور والانصراف داخل مشروع الشركة (tenant)
--
-- ⚠️ يُطبَّق داخل مشروع الشركة (tenant) عبر SQL Editor — ليس مشروع المنصة.
-- الغرض: تطبيق جداول موديول الحضور (hr_attendance + hr_attendance_settings)
-- على tenant قائم قبل استخدام الموديول، دون إعادة provisioning.
-- أي provisioning جديد يطبق هذه الجداول تلقائيًا في خطوة apply_schema.
--
-- يتطلب تنفيذًا قبله: نواة tenant-schema.ts (profiles + set_updated_at)
-- وجداول HR الأساسية من hr-employees.sql (يرث hr_attendance مرجع hr_employees
-- ودالة is_company_admin المعرفة هناك).
-- المصدر الأصلي للـ DDL: القسم «8) الحضور والانصراف» داخل
-- supabase/functions/tenant-admin/hr-schema.ts — هذا الملف مرآة يدوية له.
-- Idempotent بالكامل: آمن إعادة تشغيله على نفس المشروع.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 8) الحضور والانصراف ──────────────────────────────────────────────────

-- سجل حضور يوم واحد لموظف — unique (employee_id, work_date) يمنع
-- تكرار تسجيل نفس الموظف في نفس اليوم
create table if not exists hr_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references hr_employees (id) on delete cascade,
  work_date date not null,
  check_in time,
  check_out time,
  status text not null default 'present'
    check (status in ('present', 'late', 'absent', 'on_leave')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);

drop trigger if exists trg_hr_attendance_updated on hr_attendance;
create trigger trg_hr_attendance_updated
  before update on hr_attendance
  for each row execute function set_updated_at();

-- إعدادات الحضور — صف واحد لكل شركة (singleton على مستوى التطبيق):
-- ساعات العمل وفترة السماح وأيام العمل وتمكين الإضافي
create table if not exists hr_attendance_settings (
  id uuid primary key default gen_random_uuid(),
  work_start time not null default '09:00',
  work_end time not null default '17:00',
  late_grace_minutes int not null default 15
    check (late_grace_minutes >= 0),
  -- ⚠️ اصطلاح JS getDay: 0=الأحد … 6=السبت — الافتراضي الأحد–الخميس
  work_days int[] not null default '{0,1,2,3,4}',
  overtime_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_attendance_settings_updated on hr_attendance_settings;
create trigger trg_hr_attendance_settings_updated
  before update on hr_attendance_settings
  for each row execute function set_updated_at();

alter table hr_attendance enable row level security;
alter table hr_attendance_settings enable row level security;

-- hr_attendance — القراءة لأي مسجل، والإدخال أيضًا حق لفريق الشركة كله:
-- تسجيل الحضور عملية يومية لكل مستخدمي الشركة (يتوافق مع صلاحية
-- module:attendance:create الممنوحة لـ company_user في RBAC) —
-- أما التعديل والحذف فلمدير الشركة فقط
drop policy if exists "hr_attendance_read" on hr_attendance;
create policy "hr_attendance_read" on hr_attendance
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_attendance_insert" on hr_attendance;
create policy "hr_attendance_insert" on hr_attendance
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "hr_attendance_admin_update" on hr_attendance;
create policy "hr_attendance_admin_update" on hr_attendance
  for update
  using (is_company_admin())
  with check (is_company_admin());

drop policy if exists "hr_attendance_admin_delete" on hr_attendance;
create policy "hr_attendance_admin_delete" on hr_attendance
  for delete
  using (is_company_admin());

-- hr_attendance_settings — القراءة لأي مسجل، الكتابة (إنشاء/تعديل) للمدير فقط
drop policy if exists "hr_attendance_settings_read" on hr_attendance_settings;
create policy "hr_attendance_settings_read" on hr_attendance_settings
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_attendance_settings_admin_insert" on hr_attendance_settings;
create policy "hr_attendance_settings_admin_insert" on hr_attendance_settings
  for insert
  with check (is_company_admin());

drop policy if exists "hr_attendance_settings_admin_update" on hr_attendance_settings;
create policy "hr_attendance_settings_admin_update" on hr_attendance_settings
  for update
  using (is_company_admin())
  with check (is_company_admin());

create index if not exists idx_hr_attendance_employee on hr_attendance (employee_id);
create index if not exists idx_hr_attendance_date on hr_attendance (work_date);
