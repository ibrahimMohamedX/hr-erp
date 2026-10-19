/**
 * Core tenant schema — يُطبَّق داخل مشروع كل شركة (apply_schema).
 *
 * تصميم نواة عامة قابلة لإعادة الاستخدام لأنظمة ERP / POS / CRM:
 * لا شيء هنا خاص بـ HR — فقط الهيكل التأسيسي المشترك:
 *   • profiles: ربط مستخدمي Auth بدور داخلي (company_admin / company_user)
 *   • RLS: كل مستخدم يقرأ صفه فقط (service_role يتجاوز RLS بحكم التصميم)
 *   • updated_at trigger موحد
 *
 * ⚠️ Idempotent بالكامل: آمن إعادة تشغيله على نفس المشروع.
 * Modules الأعمال (HR/POS/CRM) تضيف migrations فوق هذه النواة لاحقًا.
 */

export const TENANT_SCHEMA_SQL = /* sql */ `
-- ─── نواة مشتركة (ERP / POS / CRM) ──────────────────────────────────────

create or replace function set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'company_user'
    check (role in ('company_admin', 'company_user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated
  before update on profiles
  for each row execute function set_updated_at();

-- ─── RLS: عزل داخل مشروع الشركة نفسه ────────────────────────────────────

alter table profiles enable row level security;

drop policy if exists "profiles_read_own" on profiles;
create policy "profiles_read_own" on profiles
  for select
  using (user_id = auth.uid());
`
