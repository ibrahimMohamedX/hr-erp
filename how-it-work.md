# How It Works — دليل الربط والتشغيل وأماكن التعديل

> هذا الملف هو خريطتك العملية للنظام: كيف يعمل الآن، كيف يتصل بـ Supabase،
> وأين تعدّل بالضبط حسب ما تريد تغييره.
> آخر تحديث: بعد Employees Module (جداول hr_* + CompanyApi live/demo).

---

## 1. البنية في صورة واحدة

```
┌─────────────────────────────────────────────────────────────┐
│  الواجهة (SPA) — React 19 + Vite + TS + Tailwind + shadcn     │
│  localhost:5173 (dev) · dist/ (build)                        │
│                                                              │
│  منطقتان منفصلتان تمامًا:                                     │
│   /platform  →  Platform Super Admin (لوحة المنصة)           │
│   /app      →  منطقة الشركة (Company Workspace)              │
└──────────────┬──────────────────────────────────────────────┘
               │ متى توفر إعداد حقيقي (live) / وإلا demo
┌──────────────▼──────────────────────────────────────────────┐
│  Platform Supabase Project (Control Plane) — مشروع المنصة    │
│  • جداول: platform_users · companies · subscriptions         │
│           provisioning_jobs         (كلها محمية بـ RLS)      │
│  • Edge Function: tenant-admin (Deno)                        │
│    ⚠️ الأسرار خادمية فقط: ACCESS_TOKEN · SERVICE_ROLE ·      │
│       ORG_ID · REGION (supabase secrets — لا تدخل الواجهة)   │
└──────────────┬──────────────────────────────────────────────┘
               │ Supabase Management API (من الخادم فقط)
┌──────────────▼──────────────┐  ┌────────────────────┐
│  Tenant Project: شركة (أ)    │  │  Tenant Project: ب  │  …
│  قاعدة بيانات + Auth مستقلان │  │  عزل كامل           │
│  schema النواة: profiles+RLS │  │                     │
└─────────────────────────────┘  └────────────────────┘
```

---

## 2. التشغيل الحالي (وضعين)

### التشغيل المحلي الآن (بدون أي إعداد خارجي)

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

- ادخل من `/auth/login` بـ **الوضع التجريبي** (3 أزرار أدوار).
- كل البيانات **محاكاة (mock)** موسومة بشريط "بيانات تجريبية" في كل صفحة.
- المتجر التجريبي **يثبت في `sessionStorage`** — لو عملت refresh بياناتك
  التجريبية (شركة أضفتها، اشتراك علّقته) تبقى معك — مطابق لسلوك live.

### كيف يقرر النظام الوضع؟ (live / demo)

الملك الواحد المسؤول: `src/config/env.ts` — يقرأ المتغيرات ويصدر:

| المتغيرات | الوضع الناتج |
|---|---|
| `VITE_PLATFORM_SUPABASE_URL` + `VITE_PLATFORM_SUPABASE_ANON_KEY` موجودان | **live** — جداول المنصة عبر RLS + استدعاء `tenant-admin` |
| غير موجودين (الحالي) | **demo** — المتجر المحاكي `mock-db.ts` بنفس العقود 1:1 |
| فحص انحدار كامل بوضع demo | `pnpm build --mode demo` — ملف `.env.demo` يبطل إعدادات live مؤقتًا في هذا الـ mode فقط (أولويات ملفات Vite) **دون أي تعديل على `.env.local`** |

التبديل **لا يمس أي صفحة**: الحاجز الوحيد هو
`src/features/platform/data/api.ts` (نفس الواجهة `PlatformApi` بتنفيذين).

---

## 3. الربط مع Supabase — ثلاثة عملاء منفصلون

### أ) عميل المنصة (Control Plane) — client-safe

- **أين:** `src/lib/platform/client.ts` → `getPlatformClient()`
- **متى:** وضع live فقط (استعلامات companies/subscriptions + `functions.invoke("tenant-admin")`)
- **بيانات الاتصال:** من `VITE_PLATFORM_SUPABASE_*` — anon عام + الحماية بـ RLS
  (سياسات القراءة لمستخدمي `platform_users` فقط — راجع الـ migration).

### ب) عميل شركة واحدة (للتطوير المحلي) — client-safe

- **أين:** `src/lib/supabase/client.ts` → `getSupabaseClient()` (كسول — lazy)
- **متى:** عند ضبط `VITE_SUPABASE_*` تتحول منطقة الشركة كلها إلى **live**:
  - الدخول: `signInCompany` (Supabase Auth لمشروع الشركة + صف `profiles`)
  - البيانات: `CompanyApi` → `live-api.ts` فوق جداول `hr_employees` /
    `hr_departments` / `hr_positions` / `hr_attendance` /
    `hr_attendance_settings` (المعزولة بـ RLS داخل المشروع)
- بدون الإعداد: **demo** — المتجر المحاكي `features/company/data/mock-db.ts`
  بنفس العقود 1:1 (نفس فلسفة المنصة، الحاجز: `company-api.ts`).

### ج) عميل الإدارة (Management API) — خادم فقط

- **أين:** `supabase/functions/tenant-admin/management.ts`
- **كيف:** يشتغل فقط داخل الـ Edge Function بـ `SUPABASE_ACCESS_TOKEN`
  (Edge secret) — **لا يوجد أي مسار في الواجهة يصل له أبدًا**.
- **ماذا يفعل:** إنشاء مشروع → متابعة جاهزيته → جلب المفاتيح → تشغيل SQL
  (تطبيق الـ schema) → pause/restore. الـ service_role للشركة يُجلب
  ويُستخدم لحظيًا في خطوة `create_admin` ثم **يُرمى — لا يُخزَّن في أي مكان**.

### د) قاعدة بيانات المنصة (Schema)

- **أين:** `supabase/migrations/20260117000000_platform_control_plane.sql`
- **الجداول:** `platform_users` (مستخدمو المنصة) · `companies` (الشركة +
  كل معلومات مشروعها المستقل + حقول المدير) · `subscriptions` (اشتراك
  العميل في منتجنا) · `provisioning_jobs` (سجل كل عمليات التوفير خطوة بخطوة).
- **RLS:** القراءة عبر `is_platform_admin()`، والكتابة فقط من داخل الدالة
  بصلاحية service_role.

---

## 4. دورة حياة شركة جديدة (كما تُنفَّذ فعليًا)

1. من لوحة المنصة → "إضافة شركة" (نموذج: اسم، slug، بريد المدير، خطة، مدة).
2. يبدأ **خط توفير موثق** (`provisioning_jobs`) — التقدم يظهر مباشرة خطوة بخطوة:
   `register_company → create_project → wait_healthy → fetch_api_keys →
   apply_schema (نواة profiles+RLS داخل مشروع الشركة) →
   create_admin (دعوة بريد للمدير + صف profiles) → verify_connection (فحص REST
   حقيقي) → finalize`
3. **لا خطوة تُعلَّم done قبل التحقق من نتيجتها** — وأي فشل يوثَّق في الخطوة
   نفسها والمهمة تصير failed.
4. آلية التقديم: كل استدعاء `poll` ينفذ خطوة واحدة فقط (State machine) —
   فلا تسقط الدالة مهما طال إنشاء المشروع.
5. بعدها من صفحة التفاصيل: تحقق اتصال / استعادة اتصال / **إيقاف البنية**
   (يتحقق أنها موقوفة فعلًا — لا من نجاح الاتصال) / تشغيلها (بانتظار
   الصحوة) / إعادة توفير (مع إعادة دعوة المدير) — وكلها مهام بنفس الآلية.
6. **الاشتراك منفصل صراحة عن البنية**: تعليق اشتراك العميل لا يمس مشروعه،
   والتفعيل مقفول حتى يُتحقق من اتصال المشروع.

> في الوضع الحالي (demo) كل الخطوات أعلاه محاكاة بنفس ترتيب الخادم 1:1 —
> التحول للـ live لا يغيّر الواجهة إطلاقًا.

---

## 5. أماكن التعديل — "عايز أعدل X؟ روح لـ Y"

| عايز تعدل… | الملف / المجلد |
|---|---|
| متغيرات البيئة (الوضع live/demo) | `.env.local` (انسخ من `.env.example`) + تعريفاتها في `src/config/env.ts` + `src/vite-env.d.ts` |
| بيانات العرض التجريبية (شركات، خطوات المحاكاة) | `src/features/platform/data/mock-db.ts` |
| خطوات التوفير (إضافة/تعديل خطوة) | قائمة القوالب: `supabase/functions/tenant-admin/pipeline.ts` (دالة `initialSteps`) + منطق التنفيذ: `index.ts` (دالة `advanceJob` — switch الخطوات) + عناوينها في الواجهة: `src/features/platform/components/job-progress.tsx` + `src/i18n/locales/ar.json` و`en.json` (`provisioning.steps.*`) |
| schema النواة داخل مشاريع الشركات (لـ ERP/POS/CRM) | `supabase/functions/tenant-admin/tenant-schema.ts` (SQL idempotent — أضف جداولك هناك) |
| جداول HR (موظفون/أقسام/مناصب/حضور) داخل مشاريع الشركات | `supabase/functions/tenant-admin/hr-schema.ts` — تُطبَّق تلقائيًا في خطوة apply_schema مع النواة؛ لتطبيقها يدويًا على شركة قائمة: `supabase/tenant-modules/hr-employees.sql` (الأساس) ثم `supabase/tenant-modules/hr-attendance.sql` (الحضور) |
| بيانات الموظفين/الأقسام/المناصب/الحضور (منطقة الشركة) | الحاجز: `src/features/company/data/company-api.ts` (live: `live-api.ts` · demo: `demo-api.ts` + `mock-db.ts`) · الـ hooks: `src/features/company/data/queries.ts` · حسابات الحضور النقية: `src/features/company/lib/attendance-rules.ts` |
| خطط/مدد/حالات الاشتراك | أنواعها: `src/types/tenant.ts` + منطقها: `handleSubscription` في `supabase/functions/tenant-admin/index.ts` + واجهتها: `src/features/platform/pages/subscriptions.tsx` و`company-detail.tsx` |
| جداول المنصة (Control Plane) | `supabase/migrations/20260117000000_platform_control_plane.sql` |
| أقسام HR (إضافة قسم جديد) | سجل الأقسام: `src/config/modules.ts` + مفتاحه في `src/types/hr-modules.ts` + صفحته: `src/features/company/pages/` (والموجّه في `src/features/company/pages/index.tsx`) |
| الصلاحيات والأدوار (RBAC) | الكتالوج والافتراضات: `src/lib/rbac/permissions.ts` + المقيّم: `evaluate.ts` + الأنواع: `src/types/rbac.ts` |
| الهوية/الثيم/الخطوط/الحركات | `src/index.css` (كل الـ tokens بديل واحد) |
| الترجمات | `src/i18n/locales/ar.json` + `en.json` |
| الروابط والحراس | `src/app/router.tsx` + `src/components/route-guards/` |
| الاختبارات العاملية (متصفح حقيقي) | `scripts/ui-check.mjs` — شغّلها: `node scripts/ui-check.mjs` والسيرفر مرفوع |
| الـ Edge Function (المصادقة، CORS، أسرار جديدة) | `supabase/functions/tenant-admin/index.ts` + قائمة الأسرار في `supabase/README.md` |
| التوثيق المعماري | `docs/` (01 معمارية · 03 عزل · 05 إعداد · 08 توفير) + `supabase/README.md` |

---

## 6. التحول إلى live (عند جاهزيتك) — الخطوات بالترتيب

كل التفاصيل في `supabase/README.md`، والملخص:

1. أنشئ مشروع Supabase للمنصة (الخطة المجانية كافية).
2. `supabase link` + `db push` (تطبيق الـ migration).
3. أنشئ أول مستخدم من لوحة Auth وأدرجه في `platform_users` (SQL في الـ migration).
4. `supabase secrets set` — الأسرار الأربعة (ACCESS_TOKEN / SERVICE_ROLE / ORG_ID / REGION).
5. `supabase functions deploy tenant-admin --no-verify-jwt` — البوابة ترفض
   preflight بلا هذه العلامة، والمصادقة تتم داخل الدالة عبر
   `requirePlatformAdmin` (التفاصيل والأمر التشخيصي في `supabase/README.md`).
6. ضع `VITE_PLATFORM_SUPABASE_URL` + `ANON_KEY` في `.env.local` →
   اللوحة تتحول تلقائيًا إلى live.
7. ⚠️ لا بريد دعوة المدير يصل إلا بضبط **SMTP في مشروع الشركة**.
8. **وضع الشركة live** (مستقل عن المنصة): أنشئ مستخدمًا في Auth لمشروع
   الشركة + صفه في `profiles` (role=company_admin) ثم اضبط
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` في `.env.local` —
   صفحة الدخول تسجل مسؤول الشركة الحقيقي وتبني جلسة `/app` كاملة،
   ووحدة الموظفين تعمل فوق جداول الشركة الحقيقية (hr_* + RLS).

نقاط `VERIFY` موسومة في `management.ts` (قيم status الفعلية للمشاريع، شكل
استجابة `database/query`، سلوك الدعوة) — تُثبَّت عند أول استخدام حقيقي.

---

## 7. سكريبتات سريعة

```bash
pnpm dev                                  # تشغيل التطوير
pnpm build                                # tsc -b && vite build
node scripts/ui-check.mjs http://localhost:4173   # الفحوص الكاملة في متصفح حقيقي (يتطلب build + preview مرفوع)
```

**فحص انحدار كامل بوضع demo — بدون أي تعديل على `.env.local`:**

```bash
pnpm build --mode demo                    # .env.demo يبطل إعدادات live في هذا الـ mode فقط
pnpm preview --port 4174 --strictPort
node scripts/ui-check.mjs http://localhost:4174
pnpm build                                # العودة للبناء الطبيعي (live)
```

- في وضع **live** يكتشف السكريبت الوضع تلقائيًا ويتخطى سيناريوهات إنشاء
  الموارد الحقيقية (توفير شركة / دورة حياة / تكرار slug) **وفحوص الحضور
  العددية والكتابية** (بذرة demo المقفلة + تسجيل حضور/انصراف + سجلات
  يدوية + إعدادات) بأسطر `SKIPPED` غير محسوبة — تشغيله آمن دائمًا ولا
  ينشئ مشاريع حقيقية ولا يكتب أي سجل حضور في live.
- **الأعداد الفعلية للفحوص:** demo كاملًا **68/68** (52 فحصًا سابقًا
  للموظفين/الأقسام/الحضور + 16 للإجازات) · live محروس **27/27** (الفحصان
  المشتركان للحضور وفحص الإجازات المشترك — تحميل الصفحة + التقارير —
  يعملان في الوضعين، والباقي خلف الحارس).
- استدعاء `tenant-admin` من المتصفح في live يتطلب النشر الصحيح
  (`--no-verify-jwt` + أمر التشخيص — راجع `supabase/README.md`).

---

## 8. موديول الحضور والانصراف (Attendance) — تشغيل وترقية الشركات القائمة

الوحدة كاملة: سجلات يومية بنطاق زمني (اليوم/آخر 7/الشهر/الكل/مخصص) +
مؤشرات (حاضر/متأخر/غائب/إجازة/متوسط الساعات) + تسجيل حضور/انصراف سريع
من الصف أو بحوارية + إضافة/تعديل/حذف يدوي حسب الصلاحيات + تقارير لكل
موظف مع تصدير CSV + إعدادات قواعد الدوام (بداية/نهاية، فترة السماح،
أيام العمل، العمل الإضافي) — كل الحسابات عبر
`src/features/company/lib/attendance-rules.ts` (مصدر وحيد، نقية).

- **شركة جديدة (provisioning):** لا شئ يدوي — `HR_SCHEMA_SQL` يبني
  `hr_attendance` + `hr_attendance_settings` تلقائيًا في خطوة apply_schema.
- **شركة قائمة (ترقية):** طبّق `supabase/tenant-modules/hr-attendance.sql`
  مرة واحدة عبر Supabase SQL Editor داخل مشروع الشركة (idempotent — آمن
  الإعادة). يتطلب قبله النواة + `hr-employees.sql` (مرجع `hr_employees`
  ودالة `is_company_admin`). حتى التطبيق: صفحة الحضور تعرض تنبيهًا
  صادقًا (`attendance.schemaHint`) — لا بيانات وهمية أبدًا.
- **الصلاحيات (RBAC):** القراءة `module:attendance:view` · تسجيل
  الحضور/الانصراف وإضافة السجلات `module:attendance:create` (فريق
  الشركة كله — مطبق في RLS: insert لأي authenticated) · التعديل/الحذف
  وإعدادات القواعد `module:attendance:update`/`delete` (المدير فقط عبر
  `is_company_admin()`).
- **فحوص المتصفح:** 14 فحصًا جديدًا في `scripts/ui-check.mjs` (قسم 5.7
  داخل بلوك company admin): تحميل + مؤشرات المقفلة 10/2/3/1 + نطاقات +
  بحث/فلاتر (متأخر=2 · هندسة=4) + تسجيل سريع حضور/انصراف + سجل مكرر
  برسالة العقد + سجل مستقبلي كامل الدورة (إضافة → تعديل → حذف) +
  ثبات الإعدادات + التقارير/CSV. القياسات والكتابية demo فقط — في live
  سطر `SKIPPED` واحد غير محسوب.

---

## 9. موديول الإجازات (Leaves) — تشغيل وترقية الشركات القائمة

الوحدة كاملة: أنواع إجازات قابلة للتهيئة (استحقاق سنوي أو بلا حد ∞ ·
مدفوعة/بدون راتب · تفعيل/تعطيل) + طلبات بدورة قرار كاملة (معلق →
معتمد/مرفوض بسبب إلزامي · إلغاء حالة مستقلة — لا حذف أبدًا: سجل تدقيقي)
+ أرصدة لكل موظف × نوع + 5 مؤشرات + بحث وفلاتر (النوع/الحالة) + تقارير
لكل نوع مع CSV — وربط آمن بالحضور: فعل صريح (`تطبيق على الحضور`) ينشئ
سجلات `on_leave` لأيام العمل **الخالية فقط** ولا يعدّل أي سجل قائم أبدًا.
كل الحسابات عبر `src/features/company/lib/leave-rules.ts` (مصدر وحيد،
نقية — يستهلكه live وdemo والواجهات).

- **شركة جديدة (provisioning):** لا شيء يدوي — القسم 9 داخل `HR_SCHEMA_SQL`
  يبني `hr_leave_types` + `hr_leave_requests` مع RLS ويزرع الأنواع
  الافترية (سنوية 21 · مرضية 10 · عارضة 7 · بدون راتب بلا حد) idempotent.
- **شركة قائمة (ترقية):** طبّق `supabase/tenant-modules/hr-leaves.sql` مرة
  واحدة عبر Supabase SQL Editor داخل مشروع الشركة (idempotent — آمن
  الإعادة). يتطلب قبله النواة + `hr-employees.sql`؛ وربط الحضور يتطلب
  `hr-attendance.sql` أيضًا. حتى التطبيق: صفحة الإجازات تعرض تنبيهًا
  صادقًا (`leaves.schemaHint`) — لا بيانات وهمية أبدًا.
- **الصلاحيات (RBAC):** القراءة `module:leaves:view` · تقديم الطلبات
  `module:leaves:create` (فريق الشركة كله — مطبق في RLS: insert لأي
  authenticated) · الموافقة/الرفض `module:leaves:approve` والتعديل/الإلغاء
  `module:leaves:update` وأنواع الإجازات (إضافة/تعديل/حذف)
  `module:leaves:update`/`delete` (المدير فقط عبر `is_company_admin()`) —
  **لا توجد سياسة DELETE على hr_leave_requests إطلاقًا** (الإلغاء حالة).
- **عقد الأخطاء الموحد (نفس النصوص live/demo):** "Leave request not
  found" · "Leave type already exists" · "Leave type has requests" ·
  "End date before start date" · "No working days in range" · "Leave
  request overlaps existing dates" · "Insufficient leave balance" ·
  "Only pending requests can be modified" · "Only pending requests can be
  decided" · "Only pending or approved requests can be cancelled" ·
  "Rejection reason is required" · "Only approved requests can be synced
  to attendance".
- **فحوص المتصفح:** 16 فحصًا جديدًا في `scripts/ui-check.mjs` (قسم 5.8):
  تحميل + مؤشرات المقفلة 3/3/1/1 + «قادمة» بقيمة المحرك + فلاتر
  (معلق=3 · سنوية=3) + معاينة أيام العمل والرصيد في النموذج + دورة
  كاملة (إنشاء 3→4 → تعديل → اعتماد 4/3 → رفض بسبب 1→2 → ربط بالحضور
  بعدد المحرك → إلغاء 2/3) + تحقق بيني أن السجلات المنشأة تظهر في نطاق
  حضور مخصص + رفض التداخل برسالة العقد + CRUD الأنواع (4→5→4 + منع
  المحجوب) + أرصدة مقفلة (المستهلك يخصم والملغى يُعاد) + تقارير 4 أنواع.
  القياسات والكتابية demo فقط — في live سطر `SKIPPED` واحد غير محسوب.
