-- ═══════════════════════════════════════════════════════════════════════════
-- Archai HR — Control Plane Schema (مشروع المنصة المركزي)
-- النموذج: مشروع Supabase مستقل لكل شركة عميلة (DB-per-tenant)
--
-- هذا الـ migration يُطبَّق على مشروع المنصة فقط (Platform Project) —
-- لا يُطبَّق على مشاريع الشركات المستقلة.
--
-- الأمان:
--   * كل الجداول RLS مفعل — القراءة/الكتابة للمستخدمين
--     المسجلين في platform_users فقط (Edge Function يعمل بصلاحيات
--     service_role للعمليات الإدارية، والتحقق من الدور يتم داخل الدالة).
--   * ⚠️ لا تُخزَّن مفاتيح إدارية هنا: Management API token يعيش
--     كـ Edge Function secret على الخادم فقط. anon key للشركة
--     (client-safe بطبيعته) يُخزَّن في companies ويحرسه RLS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── أداة التوقيت ────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── 1) مستخدمو المنصة (Super Admins) ────────────────────────────────────────

create table platform_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'platform_super_admin'
    check (role in ('platform_super_admin')),
  created_at timestamptz not null default now()
);

-- ─── 2) الشركات + معلومات مشروعها المستقل ────────────────────────────────────

create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  status text not null default 'provisioning'
    check (status in ('provisioning', 'active', 'inactive', 'archived', 'provisioning_failed')),

  -- معلومات مشروع Supabase المستقل (client-safe فقط)
  project_ref text,
  project_url text,
  project_region text,
  project_infra_state text not null default 'inactive'
    check (project_infra_state in
      ('inactive', 'active', 'paused', 'paused_for_upgrade', 'restoring', 'unknown')),
  project_connection_state text not null default 'disconnected'
    check (project_connection_state in ('connected', 'degraded', 'disconnected')),
  project_anon_key text,              -- anon للشركة (آمن للعميل) — الوصول إليه محروس بـ RLS
  project_last_verified_at timestamptz,

  admin_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_companies_updated before update on companies
  for each row execute function set_updated_at();

create index idx_companies_status on companies (status);

-- ─── 3) اشتراك العميل في منتجنا — منفصل تمامًا عن البنية التحتية ─────────────

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique not null references companies (id) on delete cascade,
  plan text not null default 'starter'
    check (plan in ('starter', 'growth', 'enterprise', 'custom')),
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired')),
  seats integer,
  current_period_start date not null default current_date,
  current_period_end date not null default current_date + 30,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_subscriptions_updated before update on subscriptions
  for each row execute function set_updated_at();

-- ─── 4) مهام التوفير — لا نجاح بدون تحقق موثق ────────────────────────────────

create table provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  action text not null check (action in
    ('provision', 'reprovision', 'reconnect', 'verify', 'pause_infra', 'resume_infra')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  steps jsonb not null default '[]'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_jobs_company on provisioning_jobs (company_id, started_at desc);

-- ─── RLS — كل شيء محروس بمستخدمي المنصة ─────────────────────────────────────

alter table platform_users enable row level security;
alter table companies enable row level security;
alter table subscriptions enable row level security;
alter table provisioning_jobs enable row level security;

create or replace function is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_users
    where user_id = auth.uid()
  )
$$;

-- المستخدم يقرأ صفه في platform_users فقط
create policy "platform_users_read_own" on platform_users
  for select using (user_id = auth.uid());

-- كل جداول الإدارة: قراءة فقط لمستخدم المنصة؛
-- الكتابة تتم حصريًا عبر Edge Function (service_role) بعد التحقق من الدور.
create policy "companies_read_admin" on companies
  for select using (is_platform_admin());

create policy "subscriptions_read_admin" on subscriptions
  for select using (is_platform_admin());

create policy "jobs_read_admin" on provisioning_jobs
  for select using (is_platform_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- تفعيل أول Super Admin (بعد إنشاء مستخدم Auth من لوحة Supabase):
--
--   insert into platform_users (user_id, full_name)
--   values ('<auth-user-uuid>', 'Platform Admin');
-- ═══════════════════════════════════════════════════════════════════════════
