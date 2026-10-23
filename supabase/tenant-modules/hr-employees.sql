-- ═══════════════════════════════════════════════════════════════════════════
-- HR Module Schema — جداول أقسام HR داخل مشروع الشركة (tenant)
--
-- ⚠️ يُطبَّق داخل مشروع الشركة (tenant) عبر SQL Editor — ليس مشروع المنصة.
-- الغرض: تطبيق الـ HR schema على tenant قائم دون إعادة provisioning.
-- أي provisioning جديد يطبق هذه الجداول تلقائيًا في خطوة apply_schema.
--
-- يتطلب: نواة tenant-schema.ts (profiles + set_updated_at) منفذة قبله.
-- Idempotent بالكامل: آمن إعادة تشغيله على نفس المشروع.
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
