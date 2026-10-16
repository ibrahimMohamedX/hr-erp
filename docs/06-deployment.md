# 06 — النشر (Deployment)

> الخيار الافتراضي الحالي: **Firebase Hosting** — مؤقت وقابل للتغيير في أي وقت.
> لم يُنفَّذ أي نشر فعلي في هذه المرحلة.

## 1. ما هو جاهز في المشروع

- `firebase.json` — إعداد Hosting: `public: dist` + SPA rewrite (كل المسارات ترجع `index.html`) + caching للـ hashed assets.
- `.firebaserc.example` — نموذج ربط مشروع Firebase (انسخه إلى `.firebaserc` واملأ `YOUR_FIREBASE_PROJECT_ID`). الملف الفعلي مُستثنى من Git.

## 2. خطوات أول نشر (عند الحاجة لاحقًا)

```bash
pnpm add -g firebase-tools   # أو npx مؤقت
firebase login
cp .firebaserc.example .firebaserc   # ثم املأ project id
firebase use <project-id>
pnpm build                  # يولد dist/
firebase deploy --only hosting
```

⚠️ **قبل أي نشر:** متغيرات `VITE_*` تُدمج في وقت البناء — يجب توفير `.env.production` (أو ما يعادله في بيئة الـ CI) قبل `pnpm build` وإلا يُنشر بدون Supabase.

## 3. البدائل المفتوحة (قرار النشر النهائي مؤجل)

| الخيار | الملاءمة | ملاحظة |
|---|---|---|
| Firebase Hosting | افتراضي حالي | SPA rewrite جاهز + CDN عالمي |
| Vercel / Netlify | ممتازان لـ Vite | دعم env vars مدمج + معاينة PRs |
| Cloudflare Pages | أداء عالمي + قرب من Supabase edge | SPA rewrite يدوي بسيط |
| استضافة ذاتية | تحكم كامل | مسؤولية تشغيل عليك |

كلها تدعم SPA — التحويل بينها لا يتطلب أي تعديل كود.
