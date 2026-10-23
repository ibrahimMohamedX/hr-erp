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
# اختياري: PROVISION_DB_PASS (كلمة مرور موحدة) · ALLOWED_ORIGIN (قصر CORS في الإنتاج — افتراضيها `*` دون ضبط)
```

- **SUPABASE_ACCESS_TOKEN**: أنشئه من [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) — يحتاج صلاحية إنشاء مشاريع داخل الـ organization.
- **SUPABASE_SERVICE_ROLE_KEY**: من Project Settings → API (service_role).
- **SUPABASE_ORG_ID**: من dashboard الـ organization (Settings → General).

## 5) نشر الـ Edge Function (خطوة حاسمة — اقرأ أولًا)

### سبب فشل استدعاءات المتصفح قبل النشر الصحيح

عند استدعاء الدالة من المتصفح يُرسل المتصفح طلب **OPTIONS (preflight)** قبل
الطلب الفعلي — وهذا الطلب **لا يحمل ترويسة `Authorization` إطلاقًا**
(قاعدة CORS: الـ preflight استعلام عن السياسة، وليس بيانات اعتماد).
قبل النشر الصحيح يحدث أحد احتمالين:

1. **الدالة غير منشورة أصلًا** → البوابة ترجع **404** على OPTIONS.
2. **الدالة منشورة مع `verify jwt` الافتراضي** → البوابة ترفض OPTIONS بـ
   **401** (لا يوجد Authorization header لتتحقق منه) — وهذا سلوك Supabase
   الموثق للدوال المستدعاة مباشرة من المتصفح.

كلاهما يظهر في المتصفح كالرسالة:
*"preflight request doesn't pass access control check: it does not have
HTTP ok status"*.

### أمر النشر الصحيح

```bash
supabase functions deploy tenant-admin --project-ref <platform-ref> --no-verify-jwt
```

**لماذا `--no-verify-jwt` لا يُضعف الأمان هنا؟**

- ما يتجاوز هذه العلامة هو فحص JWT على مستوى البوابة — والـ preflight
  (OPTIONS) لا يحمل JWT أصلًا بطبيعته، فالفحص هناك بلا معنى.
- الحماية الفعلية كاملة داخل الدالة نفسها: **كل طلب POST** يمر عبر
  `requirePlatformAdmin` (Supabase Auth + صف في جدول `platform_users`) —
  بلا توكن مدير منصة صالح لا يُنفذ شيء، بوابةً أو بلا بوابة.
- هذا هو النمط الذي توصي به Supabase رسميًا للدوال المستدعاة من المتصفح.

### تسلسل الأوامر الكامل بالترتيب

```bash
supabase login
supabase link --project-ref <platform-ref>
supabase secrets set --project-ref <platform-ref> \
  SUPABASE_ACCESS_TOKEN=<personal-access-token> \
  SUPABASE_SERVICE_ROLE_KEY=<platform-service-role-key> \
  SUPABASE_ORG_ID=<organization-id> \
  PROVISION_REGION=eu-central-1
supabase functions deploy tenant-admin --project-ref <platform-ref> --no-verify-jwt
```

(عنوان مشروع المنصة الحالي: `osmzicwshrfmeyepoqcf` — ضعه مكان
`<platform-ref>`.)

### تشخيص ما بعد النشر (PowerShell)

الطلب التالي يجب أن يرجع **204** مع ترويسات `access-control-*` في الرد:

```powershell
curl.exe -i -X OPTIONS "https://osmzicwshrfmeyepoqcf.supabase.co/functions/v1/tenant-admin" -H "Origin: http://localhost:4173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: authorization,content-type,apikey,x-client-info"
```

- **204 + ترويسات** → النشر سليم والواجهة ستصل الدالة.
- **404** → الدالة غير منشورة (أعد أمر النشر).
- **401 أو 40x آخر** → نُشرت بدون `--no-verify-jwt` (أعد النشر بالعلامة).

### سجلات الدالة

فحص سجلات التنفيذ: **Dashboard ← Edge Functions ← tenant-admin ← Logs** —
لا يمكن الوصول لهذه السجلات من بيئة الكود نفسها؛ راجعها من اللوحة عند
تتبع فشل أي خطوة توفير.

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
- **دلالة الإيقاف**: مهمة `pause_infra` تنجح فقط عند تأكيد أن المشروع
  **موقوف فعلًا** (`verify_paused` عبر حالة المشروع) — ومهمة `resume_infra`
  تنتظر صحوة المشروع (`wait_healthy`) ثم تتحقق من الاتصال.
- **عدّاد المحاولات** محفوظ داخل الخطوة نفسها (steps jsonb → `tries`)
  وميزانيته: 10 للاتصال العادي و60 للاستئناف (الصحوة تستغرق دقائق).
- **Idempotency**: slug مكرر → 409 `slug_taken`؛ ومهمة نشطة بنفس النوع على
  نفس الشركة تُرجَع كما هي (`existing: true`) — لا مهام مكررة.
- **الفصل**: `subscriptions` (اشتراك العميل عندنا) لا يمس البنية التحتية —
  إيقاف البنية عبر `pause_infra` والاشتراك عبر `subscription.update` مساران مستقلان.
- **تجهيز المشروع الجديد** (خطوتان داخل الـ pipeline):
  - `apply_schema`: يطبق نواة الـ schema المشتركة (profiles + RLS) ثم
    جداول HR (hr_departments · hr_positions · hr_employees + RLS) داخل
    مشروع الشركة عبر Management API (`database/query`) — SQL idempotent
    قابل لإعادة الاستخدام لأنظمة ERP/POS/CRM (tenant-schema.ts + hr-schema.ts).
  - `create_admin`: دعوة أول مدير للشركة بالبريد عبر service_role
    (يُجلب للاستخدام الفوري فقط ولا يُخزَّن) + إنشاء صف profiles له.
    ⚠️ يتطلب **SMTP مضبوطًا في مشروع الشركة** ليصل بريد الدعوة —
    راجع Authentication → SMTP في إعدادات مشروع العميل.
- **حدود معروفة (VERIFY عند أول استخدام فعلي)**:
  - قيمة `status` في GET /v1/projects — الكود يقبل `ACTIVE` (و`PAUSED`
    لتأكيد الإيقاف).
  - endpoint مفاتيح `api-keys?reveal=true` — لو تغيرت الواجهة تحتاج تعديل `management.ts` فقط.
  - endpoint تشغيل SQL `database/query` (شكل الاستجابة عند خطأ SQL).
  - سلوك `inviteUserByEmail` (إنشاء المستخدم فورًا قبل قبول الدعوة).

## HR Module Schema — التطبيق على tenant قائم يدويًا

كل provisioning جديد (من الآن) يطبق جداول HR تلقائيًا في خطوة `apply_schema`.

لتطبيقها على **tenant قائم** (مثل مشروع شركة واحد للتطوير المحلي) دون
إعادة provisioning:

1. افتح **SQL Editor** في مشروع الشركة (وليس مشروع المنصة).
2. تأكد أولًا أن نواة `tenant-schema.ts` مطبقة (جدول `profiles` موجود).
3. الصق محتوى [`supabase/tenant-modules/hr-employees.sql`](tenant-modules/hr-employees.sql) واضغط **Run**.

الـ SQL idempotent — آمن إعادة تشغيله. البادئة `hr_` تمنع تعارض أسماء مع
modules أخرى مستقبلًا (POS/CRM) داخل نفس مشروع الشركة.

## Attendance Module Schema — الحضور على tenant قائم يدويًا

جداول الحضور (`hr_attendance` + `hr_attendance_settings`) تُطبَّق تلقائيًا مع كل
provisioning جديد (نفس خطوة `apply_schema` مع بقية جداول HR).

لتطبيقها على **tenant قائم** قبل استخدام موديول الحضور:

1. افتح **SQL Editor** في مشروع الشركة (وليس مشروع المنصة).
2. تأكد أولًا أن نواة `tenant-schema.ts` وجداول `hr-employees.sql` مطبقة
   (وجود `profiles` و `hr_employees` — الحضور يرتبط بهما: FK على
   `hr_employees` ودالة `is_company_admin`).
3. الصق محتوى [`supabase/tenant-modules/hr-attendance.sql`](tenant-modules/hr-attendance.sql) واضغط **Run**.

الـ SQL idempotent — آمن إعادة تشغيله. المصدر الأصلي للـ DDL: القسم
«8) الحضور والانصراف» داخل `supabase/functions/tenant-admin/hr-schema.ts`.

## Leave Module Schema — الإجازات على tenant قائم يدويًا

جداول الإجازات (`hr_leave_types` + `hr_leave_requests`) تُطبَّق تلقائيًا مع كل
provisioning جديد (نفس خطوة `apply_schema` مع بقية جداول HR)، ومعها بذرة
الأنواع الافترية (سنوية 21 · مرضية 10 · عارضة 7 · بدون راتب بلا حد).

لتطبيقها على **tenant قائم** قبل استخدام موديول الإجازات:

1. افتح **SQL Editor** في مشروع الشركة (وليس مشروع المنصة).
2. تأكد أولًا أن نواة `tenant-schema.ts` وجداول `hr-employees.sql` مطبقة
   (وجود `profiles` و `hr_employees` و دالة `is_company_admin`).
3. الصق محتوى [`supabase/tenant-modules/hr-leaves.sql`](tenant-modules/hr-leaves.sql) واضغط **Run**.

ملاحظات:

- ربط الإجازات بالحضور (تطبيق طلب معتمد كسجلات `on_leave`) يكتب في
  `hr_attendance` — عند استخدامه على tenant قائم طبّق
  [`hr-attendance.sql`](tenant-modules/hr-attendance.sql) أولًا.
- لا يوجد حذف لطلبات الإجازة في الـ schema (سجل تدقيقي) — الإلغاء حالة
  مستقلة، ولا يُحذف نوع إجازة له طلبات (restrict).

الـ SQL idempotent — آمن إعادة تشغيله. المصدر الأصلي للـ DDL: القسم
«9) الإجازات» داخل `supabase/functions/tenant-admin/hr-schema.ts`.
