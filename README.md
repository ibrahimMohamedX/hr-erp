# Archai HR — نظام موارد بشرية SaaS متعدد الشركات

واجهة **HR ERP Multi-Tenant SaaS** احترافية، مبنية على **Archai Design System** (كربون ومعدن ونيون)، مع Supabase كـ Backend.

> 📚 **التوثيق المعماري الكامل في [docs/](docs/):** المعمارية · الأقسام · Tenancy · RBAC · Supabase · النشر · Roadmap.

## Stack

| الطبقة | المكتبة |
|---|---|
| الأساس | React 19 + Vite 8 + TypeScript 7 |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`) |
| Components | shadcn/ui (new-york) + Radix UI (الحزمة الموحدة) |
| Icons | lucide-react |
| Routing | react-router v8 (declarative) |
| Server State | @tanstack/react-query v5 (+ DevTools) |
| Tables | @tanstack/react-table v9 |
| Forms + Validation | react-hook-form + zod + @hookform/resolvers |
| Charts | recharts (عبر مكون chart في shadcn) |
| Calendar | react-day-picker + date-fns |
| Toasts | sonner |
| i18n | i18next + react-i18next (عربي RTL / إنجليزي LTR) |
| Backend & Auth | Supabase (Postgres + Auth + RLS) — عبر env vars فقط |
| Fonts | Fontsource: IBM Plex Sans Arabic · Readex Pro · Sora · JetBrains Mono |

## Scripts

```bash
pnpm dev      # خادم التطوير
pnpm build    # tsc -b && vite build
pnpm preview  # معاينة نسخة الإنتاج
```

## الهوية (Archai Design System)

- **الأساس داكن** (Carbon `#1B2228` / Panel `#222B33`) والفاتح استثناء (Paper `#F1F4F7`)
- **Signal:** Arc Blue `#2ED2FF` · **Accent:** Copper `#C48A5C`
- تدرج Slate كامل مطابق للـ DS (50→950) يُستبدل به الافتراضي في Tailwind
- Radius: 8 / 12 / 20 / full · Motion: `--motion-fast/base/slow` مع `cubic-bezier(.2,.8,.2,1)`
- Utilities مخصصة: `bg-chrome`, `text-chrome`, `glow-arc`, `glow-soft`, `focus-arc`, `glass`
- الخطوط: عناوين عربية **Readex Pro** · متن **IBM Plex Sans Arabic** · لاتيني **Sora** · أكواد **JetBrains Mono**
- قاعدة العربي: مفيش letter-spacing على العربي (مفروضة في `index.css`)
- الـ tokens كلها CSS variables في `src/index.css` — قابلة للتوسع عبر تعريف قيم جديدة فقط

## البنية

```
src/
├─ app/               Providers + Router (الفصل بين /platform و /app)
├─ config/
│  ├─ env.ts          الإعدادات المركزية — المصدر الوحيد لمتغيرات البيئة
│  └─ modules.ts      سجل أقسام HR (المصدر الوحيد لحقيقة الأقسام)
├─ types/             common · tenant · user · rbac · hr-modules
├─ lib/
│  ├─ supabase/       config مُتحقق + lazy client (بدون أسرار)
│  └─ rbac/           كتالوج الصلاحيات + مقيّم القواعد
├─ features/
│  ├─ auth/           Session + guards hooks + login placeholder
│  ├─ platform/       منطقة Platform Super Admin (منفصلة تمامًا)
│  ├─ company/        منطقة الشركة (Shell + صفحة قسم عامة)
│  └─ root/           نقطة الدخول التمهيدية
├─ components/
│  ├─ route-guards/   RequireAuth · RequirePlatformAdmin · RequireCompanyUser
│  ├─ ui/             40 مكون shadcn/ui
│  ├─ theme-provider  # Dark Mode (next-themes · الافتراضي dark)
│  └─ i18n-provider   # مزامنة dir/lang مع اللغة
├─ i18n/              locales (ar/en) + init
└─ index.css          هوية Archai Design System (tokens)
docs/                 التوثيق المعماري الكامل (7 ملفات)
design-system/        ملفات الهوية الأصلية (HTML/PDF/PNG) + .extract للصفحات المستخرجة
```

> ⚠️ **مبدأ أمني حاكم:** إخفاء عناصر الواجهة ليس نظام صلاحيات — الحماية الفعلية عبر **Supabase RLS** والتحقق من جهة الخادم (docs/05-supabase.md).

## إعداد البيئة

انسخ `.env.example` إلى `.env.local` واملأ `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (لا تضع SERVICE_ROLE KEY أبدًا).

## إضافة مكونات جديدة

```bash
pnpm dlx shadcn@latest add <component>
```

> ملاحظة: مكونات shadcn الحالية تستورد `cn` من حزمة `cn` (أسلوب الـ registry الحالي) بينما `@/lib/utils` متاحة لكود التطبيق.
