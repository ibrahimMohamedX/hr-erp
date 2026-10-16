# 07 — خارطة الطريق (Roadmap) والمتبقي

> حالة نهاية المرحلة الحالية (الأساس المعماري): هيكل + types + config + routing + توثيق كامل + Build أخضر.
> لا شيء من بنود التنفيذ أدناه بدأ بعد — وهذا مقصود.

## ما اكتمل في هذه المرحلة ✅

- توثيق النظام كاملًا: معمارية · أقسام HR التسعة · tenancy · RBAC · Supabase · نشر · roadmap.
- `src/types/`: common · tenant · user (الأدوار الثلاثة) · rbac · hr-modules — كلها موثقة داخليًا.
- `src/config/env.ts` — إعدادات مركزية بتحقق Zod + `.env.example` (صفر أسرار).
- `src/lib/supabase/` — إعداد محقق + عميل كسول مع رسائل خطأ واضحة.
- `src/lib/rbac/` — كتالوج صلاحيات + افتراضات الأدوار + مقيّم أساسي (ترتيب: user → role → defaults → deny).
- `src/features/` — auth (session هيكلي + guards hooks) · platform (shell + 5 صفحات placeholder) · company (shell + لوحة + صفحة قسم عامة) · root.
- Routing منفصل تمامًا: `/platform/*` (Platform Super Admin) مقابل `/app/*` (الشركة) مع حراس سلسلة صحيحة.
- Firebase Hosting: `firebase.json` + `.firebaserc.example` — بدون نشر.
- Build + type check ناجحان (tsc -b && vite build = exit 0).

## المراحل القادمة (مرتبة)

### المرحلة القادمة مباشرة — ربط المصادقة (Auth Wire-up)
- Supabase Auth: `onAuthStateChange` في `SessionProvider` + بناء `AppSession` (user/profile/tenant).
- صفحة `/auth/login` فعلية + حماية مزدوجة (guards في الواجهة + RLS عند أول migration).
- جدول `profiles` + seed مستخدم Platform Super Admin أول.

### قاعدة البيانات والـ RLS (Database Foundation)
- تنفيذ المخطط المرجعي (docs/05) كـ migrations + سياسات RLS لكل جدول.
- جداول المنصة أولًا (companies · subscriptions · profiles) ثم جداول الأقسام عند بنائها.

### منطقة المنصة فعليًا (Platform Dashboard)
- قائمة الشركات الحقيقية (TanStack Query) · إنشاء شركة · حالة الاتصال · نظرة الاستخدام.
- إدارة مستخدمي المنصة + دعوات Company Admin عند إنشاء شركة.

### أقسام HR (حسب الترتيب في docs/02)
1. Departments → 2. Employees → 3. Attendance → 4. Leaves → 5. Payroll
→ 6. Permissions UI → 7. Recruitment → 8. Performance → 9. Reports.

### الـ Rules Engine الكامل
- جلب القواعد من الخادم في `useCan` تلقائيًا · شروط ديناميكية (DSL) · واجهة إدارة القواعد · قواعد حسب `company_role`.

### الاشتراكات والخطط (Subscriptions)
- دورة حياة كاملة (trial → active → suspended...) · حدود الخطط · إدارة المقاعد — بعد جلب بيانات حقيقية للمنصة.

### النشر (Deployment)
- أول نشر Firebase Hosting عند الجاهزية — أو تحويل لأي بديل (docs/06) بلا تعديل كود.

## تحسينات تقنية مؤجلة (tech debt مسجل)

- **Code-splitting:** حجم الـ bundle الحالي 521KB (minified) فوق حد تحذير الـ 500KB — يُعالج بـ lazy routes (`React.lazy` لكل منطقة/قسم) عند بدء بناء الصفحات الفعلية.
- **Tests:** لا يوجد test runner بعد — أول ما يُضاف عند بدء التنفيذ: unit للمقيّم `evaluateAccess` + type-level tests للأنواع.
- **ESLint/Prettier:** غير مضبوطين بعد — يُضافان قبل بدء العمل الجماعي على الأقسام.
