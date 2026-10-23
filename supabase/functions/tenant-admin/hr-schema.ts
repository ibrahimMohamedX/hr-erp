/**
 * HR Module Schema — يُطبَّق داخل مشروع كل شركة (apply_schema) بعد النواة.
 *
 * البادئة hr_ لتفادي أي تعارض مع modules أخرى مستقبلًا (POS/CRM).
 * لا tenant_id في الجداول — العزل فيزيائي: كل شركة بمشروع Supabase مستقل.
 *
 * الجداول:
 *   • hr_departments: الهيكل التنظيمي (الأقسام)
 *   • hr_positions: المسميات الوظيفية داخل كل قسم
 *   • hr_employees: الملف الوظيفي الشامل
 *     - employee_code تلقائي عند غيابه (sequence + trigger)
 *     - بدون unique على email — سجل HR ليس حساب auth
 *       (الموظف لا يُسجّل دخولًا ببريده إلا لو رُبط بحساب auth عبر user_id)
 *   • hr_attendance: سجل حضور يوم واحد لموظف — unique (employee_id, work_date)
 *   • hr_attendance_settings: قواعد الدوام القابلة للتهيئة (singleton)
 *   • hr_leave_types: أنواع الإجازات واستحقاقها السنوي القابل للتهيئة
 *     (بذرة افترية idempotent: سنوية 21 · مرضية 10 · عارضة 7 · بدون راتب بلا حد)
 *   • hr_leave_requests: طلبات الإجازة ودورة موافقتها (لا حذف — الإلغاء حالة)
 *   • RLS: القراءة لأي مستخدم مسجل في مشروع الشركة (معزول أصلًا)؛
 *     الكتابة (insert/update/delete) لمدير الشركة فقط (is_company_admin)
 *     — استثناءان: إدخال سجلات الحضور وإدخال طلبات الإجازة حق لفريق
 *     الشركة كله (يتوافق مع صلاحيتي module:attendance:create و
 *     module:leaves:create لـ company_user في RBAC).
 *     لا توجد سياسة delete على hr_leave_requests — سجل تدقيقي كامل.
 *     security definer على is_company_admin ضروري لتفادي recursive RLS
 *     لأن سياسة profiles تسمح بقراءة صفك فقط.
 *
 * ⚠️ Idempotent بالكامل: آمن إعادة تشغيله على نفس المشروع.
 * ⚠️ يتطلب نواة tenant-schema.ts (profiles + set_updated_at) منفذة قبله.
 */

export const HR_SCHEMA_SQL = /* sql */ `
-- ═══════════════════════════════════════════════════════════════════════════
-- HR Module Schema — جداول أقسام HR داخل مشروع الشركة (tenant)
-- يتطلب: profiles + set_updated_at() من النواة (tenant-schema.ts)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1) الأقسام (الهيكل التنظيمي) ────────────────────────────────────────

create table if not exists hr_departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  manager_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(code)
);

drop trigger if exists trg_hr_departments_updated on hr_departments;
create trigger trg_hr_departments_updated
  before update on hr_departments
  for each row execute function set_updated_at();

-- ─── 2) المسميات الوظيفية ───────────────────────────────────────────────

create table if not exists hr_positions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  department_id uuid references hr_departments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(code)
);

drop trigger if exists trg_hr_positions_updated on hr_positions;
create trigger trg_hr_positions_updated
  before update on hr_positions
  for each row execute function set_updated_at();

-- ─── 3) الموظفين ────────────────────────────────────────────────────────

create table if not exists hr_employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  full_name text not null,
  email text not null,
  -- ⚠️ لا unique على email: سجل HR ليس حساب auth — موظف بلا حساب
  --    دخول قيمة مشروعة (يُربط لاحقًا عبر user_id عند دعوته للنظام)
  phone text,
  job_title text not null,
  position_id uuid references hr_positions (id) on delete set null,
  department_id uuid not null references hr_departments (id) on delete restrict,
  hire_date date not null,
  salary numeric(12,2),
  status text not null default 'probation'
    check (status in ('active', 'probation', 'suspended', 'terminated')),
  user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_hr_employees_updated on hr_employees;
create trigger trg_hr_employees_updated
  before update on hr_employees
  for each row execute function set_updated_at();

-- ─── 4) توليد employee_code تلقائيًا عند غيابه ──────────────────────────

create sequence if not exists hr_employee_code_seq start 1;

create or replace function set_hr_employee_code()
returns trigger
language plpgsql
as $fn$
begin
  if new.employee_code is null or new.employee_code = '' then
    new.employee_code := 'EMP-' || lpad(nextval('hr_employee_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_hr_employees_code on hr_employees;
create trigger trg_hr_employees_code
  before insert on hr_employees
  for each row execute function set_hr_employee_code();

-- ─── 5) دالة مساعدة للصلاحيات الإدارية ─────────────────────────────────

create or replace function is_company_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1 from profiles
    where user_id = auth.uid() and role = 'company_admin'
  )
$fn$;

-- ─── 6) RLS — القراءة للمسجلين، الكتابة لمدير الشركة ────────────────────

alter table hr_departments enable row level security;
alter table hr_positions enable row level security;
alter table hr_employees enable row level security;

-- hr_departments
drop policy if exists "hr_departments_read" on hr_departments;
create policy "hr_departments_read" on hr_departments
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_departments_admin_write" on hr_departments;
drop policy if exists "hr_departments_admin_insert" on hr_departments;
create policy "hr_departments_admin_insert" on hr_departments
  for insert
  with check (is_company_admin());

drop policy if exists "hr_departments_admin_update" on hr_departments;
create policy "hr_departments_admin_update" on hr_departments
  for update
  using (is_company_admin())
  with check (is_company_admin());

drop policy if exists "hr_departments_admin_delete" on hr_departments;
create policy "hr_departments_admin_delete" on hr_departments
  for delete
  using (is_company_admin());

-- hr_positions
drop policy if exists "hr_positions_read" on hr_positions;
create policy "hr_positions_read" on hr_positions
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_positions_admin_insert" on hr_positions;
create policy "hr_positions_admin_insert" on hr_positions
  for insert
  with check (is_company_admin());

drop policy if exists "hr_positions_admin_update" on hr_positions;
create policy "hr_positions_admin_update" on hr_positions
  for update
  using (is_company_admin())
  with check (is_company_admin());

drop policy if exists "hr_positions_admin_delete" on hr_positions;
create policy "hr_positions_admin_delete" on hr_positions
  for delete
  using (is_company_admin());

-- hr_employees
drop policy if exists "hr_employees_read" on hr_employees;
create policy "hr_employees_read" on hr_employees
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_employees_admin_insert" on hr_employees;
create policy "hr_employees_admin_insert" on hr_employees
  for insert
  with check (is_company_admin());

drop policy if exists "hr_employees_admin_update" on hr_employees;
create policy "hr_employees_admin_update" on hr_employees
  for update
  using (is_company_admin())
  with check (is_company_admin());

drop policy if exists "hr_employees_admin_delete" on hr_employees;
create policy "hr_employees_admin_delete" on hr_employees
  for delete
  using (is_company_admin());

-- ─── 7) Indexes ──────────────────────────────────────────────────────────

create index if not exists idx_hr_employees_department on hr_employees (department_id);
create index if not exists idx_hr_employees_status on hr_employees (status);
create index if not exists idx_hr_positions_department on hr_positions (department_id);

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

-- ─── 9) الإجازات ──────────────────────────────────────────────────────────

-- أنواع الإجازات وقواعد استحقاقها القابلة للتهيئة لكل شركة —
-- annual_days = null يعني استحقاقًا بلا حد (نوع بلا رصيد محدد)
create table if not exists hr_leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  annual_days int,
  is_paid boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- طلب إجازة لموظف — days = أيام العمل في المدى (تحسبها الواجهة عبر
-- محرك القواعد النقي)؛ الإلغاء والرفض حالات لا حذف: سجل تدقيقي كامل
create table if not exists hr_leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references hr_employees (id) on delete cascade,
  leave_type_id uuid not null references hr_leave_types (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  days int not null check (days >= 1),
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason text,
  -- من اتخذ القرار — uuid خام بلا FK على auth.users حتى يبقى الأثر
  -- التدقيقي قائمًا لو حُذف حساب المدير لاحقًا
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

drop trigger if exists trg_hr_leave_requests_updated on hr_leave_requests;
create trigger trg_hr_leave_requests_updated
  before update on hr_leave_requests
  for each row execute function set_updated_at();

-- بذرة الأنواع الافترية — idempotent عبر unique(name) + on conflict do nothing
insert into hr_leave_types (name, annual_days, is_paid)
values
  ('إجازة سنوية', 21, true),
  ('إجازة مرضية', 10, true),
  ('إجازة عارضة', 7, true),
  ('إجازة بدون راتب', null, false)
on conflict (name) do nothing;

alter table hr_leave_types enable row level security;
alter table hr_leave_requests enable row level security;

-- hr_leave_types — القراءة لأي مسجل، الإدارة الكاملة لمدير الشركة
drop policy if exists "hr_leave_types_read" on hr_leave_types;
create policy "hr_leave_types_read" on hr_leave_types
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_leave_types_admin_insert" on hr_leave_types;
create policy "hr_leave_types_admin_insert" on hr_leave_types
  for insert
  with check (is_company_admin());

drop policy if exists "hr_leave_types_admin_update" on hr_leave_types;
create policy "hr_leave_types_admin_update" on hr_leave_types
  for update
  using (is_company_admin())
  with check (is_company_admin());

drop policy if exists "hr_leave_types_admin_delete" on hr_leave_types;
create policy "hr_leave_types_admin_delete" on hr_leave_types
  for delete
  using (is_company_admin());

-- hr_leave_requests — القراءة والإدخال (تقديم الطلب) لفريق الشركة كله
-- (يتوافق مع صلاحية module:leaves:create الممنوحة لـ company_user في
-- RBAC)؛ القرارات والتعديل والإلغاء لمدير الشركة فقط.
-- لا توجد سياسة delete على الإطلاق: الطلب سجل تدقيقي — الإلغاء حالة
-- مستقلة ('cancelled') لا حذف صف.
drop policy if exists "hr_leave_requests_read" on hr_leave_requests;
create policy "hr_leave_requests_read" on hr_leave_requests
  for select
  using (auth.role() = 'authenticated');

drop policy if exists "hr_leave_requests_insert" on hr_leave_requests;
create policy "hr_leave_requests_insert" on hr_leave_requests
  for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "hr_leave_requests_admin_update" on hr_leave_requests;
create policy "hr_leave_requests_admin_update" on hr_leave_requests
  for update
  using (is_company_admin())
  with check (is_company_admin());

create index if not exists idx_hr_leave_requests_employee_date on hr_leave_requests (employee_id, start_date);
create index if not exists idx_hr_leave_requests_type on hr_leave_requests (leave_type_id);
create index if not exists idx_hr_leave_requests_status on hr_leave_requests (status);
`
