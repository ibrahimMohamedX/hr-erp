# 01 — المعمارية العامة للنظام

> Archai HR — نظام **HR ERP SaaS متعدد الشركات (Multi-Tenant SaaS)**
> المرجع التنفيذي للبنية الحالية: جذر المشروع + هذا المجلد.

## 1. الأهداف المعمارية

1. **عزل كامل لبيانات كل شركة (Tenant Isolation)** — شركة واحدة لا ترى بيانات شركة أخرى أبدًا، والعزل مفروض على مستوى قاعدة البيانات (RLS) وليس الواجهة.
2. **فصل تام بين المنصة والشركات** — منطقة إدارة المنصة (Platform) كيان مستقل تمامًا عن منطقة عمل الشركات (Company Workspace).
3. **قابلية توسع أفقية للأقسام** — إضافة قسم HR جديد = إضافة مفتاح للسجل + مكونات تحت `/app/m/:moduleKey` بدون تعديل الجذر.
4. **صلاحيات مبنية على القواعد** — لا حالة صلبة (hardcoded) في الواجهة؛ كل قرارات العرض تعتمد على أساس الـ Rules Engine مع مصدر حقيقة واحد على الخادم.
5. **صفر أسرار في الكود** — كل الاتصالات عبر Environment Variables وملف إعدادات مركزي واحد.

## 2. القرارات الأساسية (Decisions)

| القرار | الخيار المعتمد | السبب |
|---|---|---|
| Frontend | React 19 + Vite 8 + TS 7 + Tailwind 4 + shadcn/ui | سرعة بناء UI احترافي مع Design System موحد (Archai) |
| Backend & DB & Auth | **Supabase** (Postgres + Auth + RLS) | عزل Multi-Tenant عبر RLS هو أقوى نقطة فيه، مع Auth جاهز |
| نمط العزل | Shared Database + `tenant_id` + RLS | أرخص للتشغيل وأسهل للصيانة من DB-per-tenant، مع سياسات صارمة |
| الحالة (State) | TanStack Query للسيرفر + React Context للجلسة | فصل "حالة الخادم" عن "حالة التطبيق" |
| i18n / RTL | i18next (ar/en) + `dir` switching | عربي أولًا مع RTL كامل واتجاه قابل للتبديل |
| النشر (مؤقت) | Firebase Hosting | خيار افتراضي مؤقت قابل للتغيير — قرارات النشر النهائية مفتوحة |

## 3. الصورة الكبيرة

```
┌──────────────────────────────────────────────────────────────┐
│                    Archai HR — SPA (React)                   │
│                                                              │
│  / ──────────────── نقطة تمهيدية (حالة الإعداد)              │
│  /auth/login ────── المصادقة (Supabase Auth — future)        │
│                                                              │
│  /platform/* ──────────────── منطقة المنصة                   │
│   ├─ RequireAuth + RequirePlatformAdmin                      │
│   └─ الشركات · الاشتراكات · حالة النظام · (توسعات منصة)      │
│                                                              │
│  /app/* ────────────────────── منطقة الشركة                  │
│   ├─ RequireAuth + RequireCompanyUser                        │
│   └─ /app/m/:moduleKey (أقسام HR من سجل الأقسام)             │
│         employees · attendance · leaves · payroll            │
│         recruitment · departments · performance · reports    │
│         permissions                                          │
└──────────────────────────────┬───────────────────────────────┘
                               │ (anon key — عميل عام)
┌──────────────────────────────▼───────────────────────────────┐
│                        Supabase (Postgres)                   │
│   Auth ──► profiles (role + tenant_id)                        │
│   كل جدول أعمال: tenant_id + RLS Policies                    │
│   companies · subscriptions · tenant_access_rules            │
│   tenant_operational_rules · (جداول أقسام HR — future)       │
└──────────────────────────────────────────────────────────────┘
```

## 4. هيكل المجلدات (المرحلة الحالية)

```
src/
├─ app/                       التركيب: providers.tsx + router.tsx
├─ config/
│  ├─ env.ts                  الإعدادات المركزية — المصدر الوحيد لـ import.meta.env
│  └─ modules.ts              سجل أقسام HR (الوحدة الواحدة لحقيقة الأقسام)
├─ types/                     كل الأنواع: common · tenant · user · rbac · hr-modules
├─ lib/
│  ├─ supabase/               config.ts (تحقق) + client.ts (lazy singleton)
│  └─ rbac/                   permissions.ts (كتالوج + افتراضات) + evaluate.ts (مقيّم)
├─ features/
│  ├─ auth/                   session.tsx + hooks/use-can.ts + pages/login-placeholder
│  ├─ platform/               منطقة المنصة: layout + pages (كلها placeholders)
│  ├─ company/                منطقة الشركة: layout + pages (كلها placeholders)
│  └─ root/                   صفحة الجذر (حالة الإعداد المعماري)
├─ components/
│  ├─ route-guards/           RequireAuth · RequirePlatformAdmin · RequireCompanyUser
│  ├─ page-placeholder.tsx    الصفحة الهيكلية الموحدة
│  └─ app-toggles.tsx         تبديل اللغة/المظهر للأغلفة
├─ components/ui/             40 مكون shadcn/ui (من المرحلة السابقة)
├─ i18n/                      ar.json · en.json + التهيئة
└─ index.css                  هوية Archai Design System (tokens)
```

## 5. نموذج الأمان — المبدأ الحاكم

> **إخفاء عناصر الواجهة ليس نظام صلاحيات.**

الطبقات الثلاث بالترتيب:

1. **Supabase RLS (حصن الحقيقة)** — كل استعلام يمر عبر سياسات Postgres: `tenant_id = auth.selected_tenant` أو الدور على مستوى المنصة. أي تسريب في الواجهة لا يفتح بيانات أبدًا.
2. **التحقق من جهة الخادم** — كل عمليات كتابة (approve payroll, delete employee...) تُراجع في RPC/Triggers على DB، وليس في كود العميل.
3. **الواجهة (UX فقط)** — الحراس والـ `useCan` يخفون ما لا يخص المستخدم ويحسنون التجربة؛ لا يعتبروا أبدًا حماية.

قواعد صارمة:
- ❌ لا SERVICE_ROLE KEY في أي كود عميل (أبدًا).
- ✅ ANON KEY عمومي + RLS مشدد على كل جدول.
- ❌ لا ثقة بأي payload قادم من العميل (المستخدم/الشركة/الدور يُشتق من الـ JWT على الخادم).

## 6. نقاط التوسع المخططة

- إضافة قسم HR: `HR_MODULE_KEYS` في `src/types/hr-modules.ts` + تعريف في `src/config/modules.ts` + مجلد `src/features/hr/<module>/`.
- صلاحية جديدة: مورود في `RbacResource` (`src/types/rbac.ts`) — وربما قاعدة افتراضية في `ROLE_PERMISSION_DEFAULTS`.
- لغة جديدة: ملف `src/i18n/locales/<lang>.json` + تسجيلها في `src/i18n/index.ts`.
- مزود Backend بديل: استبدال `src/lib/supabase/client.ts` بمنفذ آخر بنفس العقد — لا شيء آخر يتغير.
