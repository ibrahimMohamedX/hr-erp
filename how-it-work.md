# How It Works — دليل الربط والتشغيل وأماكن التعديل

> هذا الملف هو خريطتك العملية للنظام: كيف يعمل الآن، كيف يتصل بـ Supabase،
> وأين تعدّل بالضبط حسب ما تريد تغييره.
> آخر تحديث: بعد commit `b703930` (أساس الـ SaaS المكتمل).

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
- **متى:** تجارب محلية على مشروع شركة واحد (`VITE_SUPABASE_*`)، وصفحة الدخول
  تحاول `signInWithPassword` عليه لو مضبوط.
- ⚠️ **غير مضبوط حاليًا** — والوضع التجريبي هو المسار الوظيفي.

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
5. `supabase functions deploy tenant-admin`.
6. ضع `VITE_PLATFORM_SUPABASE_URL` + `ANON_KEY` في `.env.local` →
   اللوحة تتحول تلقائيًا إلى live.
7. ⚠️ لاache بريد دعوة المدير يصل إلا بضبط **SMTP في مشروع الشركة**.

نقاط `VERIFY` موسومة في `management.ts` (قيم status الفعلية للمشاريع، شكل
استجابة `database/query`، سلوك الدعوة) — تُثبَّت عند أول استخدام حقيقي.

---

## 7. سكريبتات سريعة

```bash
pnpm dev                                  # تشغيل التطوير
pnpm build                                # tsc -b && vite build
node scripts/ui-check.mjs http://localhost:4173   # 27 فحصًا في متصفح حقيقي (يتطلب build + preview مرفوع)
```
