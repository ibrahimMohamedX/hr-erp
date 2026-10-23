-- ═══════════════════════════════════════════════════════════════════════════
-- Leave Module Schema — جداول الإجازات داخل مشروع الشركة (tenant)
--
-- ⚠️ يُطبَّق داخل مشروع الشركة (tenant) عبر SQL Editor — ليس مشروع المنصة.
-- الغرض: تطبيق جداول موديول الإجازات (hr_leave_types + hr_leave_requests)
-- على tenant قائم قبل استخدام الموديول، دون إعادة provisioning.
-- أي provisioning جديد يطبق هذه الجداول تلقائيًا في خطوة apply_schema.
--
-- يتطلب تنفيذًا قبله: نواة tenant-schema.ts (profiles + set_updated_at)
-- وجداول HR الأساسية من hr-employees.sql (يرث hr_leave_requests مرجع
-- hr_employees ودالة is_company_admin المعرفة هناك).
-- ربط الإجازات بالحضور (applyLeaveToAttendance) يكتب في hr_attendance —
-- عند استخدام هذا الربط على tenant قائم طبّق hr-attendance.sql أولًا.
-- المصدر الأصلي للـ DDL: القسم «9) الإجازات» داخل
-- supabase/functions/tenant-admin/hr-schema.ts — هذا الملف مرآة يدوية له.
-- Idempotent بالكامل: آمن إعادة تشغيله على نفس المشروع.
-- ═══════════════════════════════════════════════════════════════════════════

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
