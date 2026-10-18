# Control Plane — دليل الإعداد والنشر

> Backend المنصة: مشروع Supabase مركزي واحد يستضيف قاعدة بيانات الإدارة
> و Edge Function واحدة (`tenant-admin`). كل شركة عميلة تحصل على
> **مشروع Supabase مستقل** يُنشأ ويُدار عبر Management API من هذا الخادم.

## 1) إنشاء مشروع المنصة

1. أنشئ مشروع Supabase جديد (الخطة المجانية كافية للبداية) — هذا هو **Platform Project**.
2. من `Project Settings → API` ستحصل لاحقًا على:
   - `VITE_PLATFORM_SUPABASE_URL` + `VITE_PLATFORM_SUPABASE_ANON_KEY` (client-safe → ملف `.env.local` للواجهة)

## 2) تطبيق الـ Schema

```bash
supabase link --project-ref <platform-ref>
supabase db push          # يطبق supabase/migrations/*.sql
```

الجداول: `platform_users` · `companies` · `subscriptions` · `provisioning_jobs`
(كلها RLS محروس — القراءة لمستخدمي المنصة فقط، الكتابة عبر service_role داخل الدالة).

## 3) أول Super Admin

1. من لوحة المشروع: **Authentication → Users → Add user** (بريد + كلمة مرور).
2. نفّذ SQL (من SQL Editor):

```sql
insert into platform_users (user_id, full_name)
values ('<auth-user-uuid>', 'Platform Admin');
```

## 4) أسرار الخادم (لا توضع في الواجهة أبدًا)

```bash
supabase secrets set --project-ref <platform-ref> \
  SUPABASE_ACCESS_TOKEN=<personal-access-token> \
  SUPABASE_SERVICE_ROLE_KEY=<platform-service-role-key> \
  SUPABASE_ORG_ID=<organization-id> \
  PROVISION_REGION=eu-central-1
# اختياري: PROVISION_DB_PASS (كلمة مرور موحدة) · ALLOWED_ORIGIN (قصر CORS في الإنتاج)
```

- **SUPABASE_ACCESS_TOKEN**: أنشئه من [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) — يحتاج صلاحية إنشاء مشاريع داخل الـ organization.
- **SUPABASE_SERVICE_ROLE_KEY**: من Project Settings → API (service_role).
- **SUPABASE_ORG_ID**: من dashboard الـ organization (Settings → General).

## 5) نشر الـ Edge Function

```bash
supabase functions deploy tenant-admin --project-ref <platform-ref>
```

## 6) واجهة المنصة

`.env.local` في جذر المشروع:

```
VITE_PLATFORM_SUPABASE_URL=https://<platform-ref>.supabase.co
VITE_PLATFORM_SUPABASE_ANON_KEY=<anon>
```

بدونها تعمل لوحة المنصة بوضع **demo** واضح التوسيم (بيانات محاكية)،
وبوجودها تتحول تلقائيًا للبيانات الحقيقية (live).

## ملاحظات التشغيل

- **خط التوفير**: POST واحد يبدأ المهمة، والواجهة تستدعي `poll` كل ~2s —
  كل استدعاء ينفذ خطوة واحدة فقط (State machine) فلا تتجاوز الدالة حدود التنفيذ.
- **مبدأ التحقق**: لا خطوة تنتقل لـ done قبل التحقق من نتيجتها، والاتصال
  يُعتبر قائمًا فقط بعد فحص REST health ناجح (`verify_connection`).
- **الفصل**: `subscriptions` (اشتراك العميل عندنا) لا يمس البنية التحتية —
  إيقاف البنية عبر `pause_infra` والاشتراك عبر `subscription.update` مساران مستقلان.
- **حدود معروفة (VERIFY عند أول استخدام فعلي)**:
  - قيمة `status` في GET /v1/projects — الكود يقبل `ACTIVE` فقط.
  - endpoint مفاتيح `api-keys?reveal=true` — لو تغيرت الواجهة تحتاج تعديل `management.ts` فقط.
