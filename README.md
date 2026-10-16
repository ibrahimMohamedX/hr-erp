# Archai HR — واجهة نظام الموارد البشرية

واجهة UI احترافية لنظام HR ERP، مبنية على **Archai Design System** (كربون ومعدن ونيون).

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
├─ components/
│  ├─ ui/            # 40 مكون shadcn/ui
│  ├─ theme-provider # Dark Mode (next-themes · الافتراضي dark)
│  └─ i18n-provider  # مزامنة dir/lang مع اللغة
├─ hooks/
├─ i18n/
│  ├─ locales/       # ar.json · en.json
│  └─ index.ts       # i18next init (fallback: ar)
├─ lib/utils.ts      # cn()
├─ App.tsx           # تركيب Providers (Query · Theme · i18n · Router · Toaster)
└─ main.tsx
design-system/       # ملفات الهوية الأصلية (HTML/PDF/PNG) + .extract للصفحات المستخرجة
```

## إضافة مكونات جديدة

```bash
pnpm dlx shadcn@latest add <component>
```

> ملاحظة: مكونات shadcn الحالية تستورد `cn` من حزمة `cn` (أسلوب الـ registry الحالي) بينما `@/lib/utils` متاحة لكود التطبيق.
