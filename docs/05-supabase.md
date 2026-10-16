# 05 — Supabase — الإعداد والأمان والمخطط

> التنفيذ الحالي: `src/config/env.ts` · `src/lib/supabase/config.ts` · `src/lib/supabase/client.ts`

## 1. الإعداد (بدون أي Hardcoded Secrets)

1. انسخ `.env.example` إلى `.env.local`.
2. من Supabase Dashboard (Project Settings → API) املأ:
   - `VITE_SUPABASE_URL` — رابط المشروع.
   - `VITE_SUPABASE_ANON_KEY` — المفتاح العام للعميل.
3. `src/config/env.ts` هو **المصدر الوحيد** لقراءة `import.meta.env` (مع تحقق Zod) — ممنوع قراءة `process.env`/`import.meta.env` في أي ملف آخر.
4. العميل (`getSupabaseClient`) كسول (lazy): لا يُنشأ إلا عند أول استخدام، ويرفع خطأ واضحًا لو الإعداد ناقص — التطبيق يشتغل بلا Supabase في هذه المرحلة الهيكلية.

**قواعد أمان ملزمة:**
- ❌ SERVICE_ROLE KEY لا يدخل أي كود عميل أبدًا — يستخدم فقط في Edge Functions/server-side عند الحاجة مستقبلًا.
- ✅ ANON KEY عام بالتصميم — والحماية الحقيقية هي **RLS على كل جدول بلا استثناء**.
- ✅ أي جدول يُنشأ مستقبلًا يجب أن يبدأ بسياسات RLS `FOR SELECT/INSERT/UPDATE/DELETE` تحصر الصفوف على `tenant_id` الصحيح.

## 2. المخطط المرجعي (Sketch — يُنفَّذ في مرحلة قاعدة البيانات)

> SQL توضيحي فقط — ليس migration منفذًا بعد.

```sql
-- الشركات (المستأجرون)
create table companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  display_name jsonb,
  logo_url text,
  status text not null default 'active',      -- active | inactive | archived
  connection_state text not null default 'connected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- البروفايل التطبيقي (1:1 مع auth.users)
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  tenant_id uuid references companies(id) on delete cascade,   -- null = مستخدم منصة
  full_name text not null,
  role text not null check (role in
    ('platform_super_admin','company_admin','company_user')),
  company_role text check (company_role in
    ('hr_manager','hr_specialist','team_lead','employee')),
  avatar_url text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- الاشتراكات (هيكل — التفعيل الفعلي مرحلة لاحقة)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid unique not null references companies(id) on delete cascade,
  plan text not null default 'starter',
  status text not null default 'trialing',
  seats integer,
  current_period_start date not null,
  current_period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- قواعد الوصول (RBAC) — يقرؤها الـ Rules Engine
create table tenant_access_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  scope text not null check (scope in ('role','user')),
  role text,
  user_id uuid references auth.users(id) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  resource text not null,   -- مثال: 'module:leaves'
  action text not null,     -- مثال: 'approve' أو '*'
  priority integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- القواعد التشغيلية (إعدادات عمل لكل شركة)
create table tenant_operational_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references companies(id) on delete cascade,
  key text not null,          -- مثال: 'leaves.max_annual_balance'
  value jsonb not null,
  enabled boolean not null default true,
  unique (tenant_id, key),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## 3. مبادئ سياسات RLS (تُنفَّذ مع أول migration فعلية)

```sql
-- دالة مساعدة: شركة المستخدم الحالي من الـ JWT (عبر join بـ profiles)
-- (شكل توضيحي — التنفيذ الفعلي قد يعتمد JWT claim مخصص أو RPC)

alter table tenant_access_rules enable row level security;

-- مثال: قواعد الشركة تُقرأ فقط من أعضائها
create policy "tenant_read_own_access_rules" on tenant_access_rules
  for select using (
    tenant_id = (select tenant_id from profiles where user_id = auth.uid())
  );

-- مثال: تعديل القواعد لـ Company Admin فقط
create policy "tenant_admin_manage_access_rules" on tenant_access_rules
  for all using (
    tenant_id = (select tenant_id from profiles where user_id = auth.uid())
    and (select role from profiles where user_id = auth.uid()) = 'company_admin'
  );

-- جداول المنصة (companies, subscriptions): يقرؤها platform_super_admin فقط
-- عبر سياسات صريحة على role — لا يجوز أن تكون public أو قابلة للقراءة عامة.
```

**منهجية إلزامية:** أي migration جديدة بدون RLS على جداولها = مرفوضة في المراجعة.

## 4. خطوات ربط المصادقة (Wire-up Phase — future)

1. تفعيل Email/Password provider (وأي مزودين مطلوبين) في Supabase Dashboard.
2. في `SessionProvider`: `supabase.auth.onAuthStateChange` → تحديث الحالة (`loading → authenticated/unauthenticated`).
3. جلب `profiles` عند الجلسة → بناء `AppSession` (user + profile + tenant).
4. `signInWithPassword` / `signUp` / `signOut` داخل `features/auth/` فقط.
5. أي حالة حافة (بروفايل ناقص، tenant محذوف) = `unauthenticated` مع توست واضح — لا افتراضات.
