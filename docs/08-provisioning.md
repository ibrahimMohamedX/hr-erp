# 08 — Provisioning & Control Plane — مشروع Supabase مستقل لكل شركة

> النموذج المعتمد: **DB-per-tenant** — كل شركة عميلة تحصل على مشروع Supabase
> مستقل بالكامل (قاعدة بيانات + Auth + موارد). المنصة تديرها عبر
> **Control Plane** مركزي آمن.
> هذا المستند يحل محل نموذج "Shared DB + tenant_id" الموصوف سابقًا في
> docs/05 — قواعد RLS هناك تنطبق الآن **داخل كل مشروع شركة**.

## 1. الصورة الكبيرة

```
┌─ Platform Project (Control Plane) ─────────────────────────┐
│  • DB: platform_users · companies · subscriptions           │
│         provisioning_jobs            (RLS: admins فقط)     │
│  • Edge Function: tenant-admin                             │
│     ⚠️ الأسرار هنا فقط (خادم):                              │
│     SUPABASE_ACCESS_TOKEN · SERVICE_ROLE · ORG_ID · REGION │
└──────────────┬───────────────────────────────────────────────┘
               │ Supabase Management API (server-side only)
   ┌───────────▼──────────┐  ┌───────────────────┐  ┌──────────┐
   │ Project: شركة (أ)     │  │ Project: شركة (ب) │  │   …      │
   │ بياناتها + مستخدموها  │  │ عزل كامل         │  │          │
   │ RLS داخل المشروع      │  │                   │  │          │
   └───────────────────────┘  └───────────────────┘  └──────────┘
```

- **الواجهة** تتصل فقط بمشروع المنصة (URL + anon — client-safe) وتستدعي
  `tenant-admin` بجلسة مستخدم المنصة. صفر مفاتيح إدارية في العميل أبدًا.
- **مستخدمو الشركة** يتصلون بمشروع شركتهم فقط (بيانات الاتصال تُسلَّم من
  المنصة بعد الدخول — مرحلة الربط القادمة).

## 2. خط التوفير (Provisioning Pipeline)

كل عملية إدارية = **مهمة موثقة** (`provisioning_jobs`) بخطوات تُتحقق
من نتيجتها قبل الانتقال للتالية:

| الخطوة | ماذا تفعل | التحقق قبل "done" |
|---|---|---|
| `register_company` | إدراج صف الشركة (status=provisioning) + اشتراك | الصف موجود |
| `create_project` | POST /v1/projects (Management API) | ref مسجَّل في companies |
| `wait_healthy` | poll GET /v1/projects/{ref} | status = ACTIVE |
| `fetch_api_keys` | جلب anon (+ service_role **بلا تخزين**) | anon محفوظ |
| `verify_connection` | فحص REST health بـ anon | استجابة 200 فعلية |
| `finalize` | الشركة active + الاشتراك trialing | الحالة مُحدَّثة |

- **لا نجاح بدون تحقق**: أي فشل يوثَّق في الخطوة نفسها + المهمة تصير failed.
- **State machine بلا تجاوزات**: كل استدعاء `poll` ينفذ خطوة واحدة فقط —
  فلا تسقط الدالة بسبب طول دورة إنشاء المشروع (1–5 دقائق).
- حارس مهلة: مهمة تتجاوز 30 دقيقة تُعتبر failed تلقائيًا.

## 3. الفصل الصريح: اشتراكان مختلفان

| | اشتراك العميل (منتجنا) | البنية التحتية (Supabase) |
|---|---|---|
| أين | `subscriptions` في Control Plane | مشروع Supabase الفعلي |
| التحكم | activate / suspend / renew / plan / duration | pause / resume (Mgmt API) |
| علاقتهما | **لا علاقة مباشرة** — تعليق اشتراك العميل لا يوقف مشروعه | والعكس صحيح |

قيد واحد مقصود: **تفعيل** اشتراك العميل يتطلب اتصال مشروع مُتحققًا منه
(`connection_state=connected`) — لا تفعيل لمشروع لم يثبت اتصاله.

## 4. الوضعان في الواجهة (live / demo)

- `VITE_PLATFORM_SUPABASE_URL` + `VITE_PLATFORM_SUPABASE_ANON_KEY`
  مضبوطان → **live**: جداول المنصة عبر RLS + `functions.invoke('tenant-admin')`.
- غير مضبوطين → **demo**: متجر محاكي بنفس خطوات الخادم 1:1، موسوم بشرائط
  وشارات "تجريبي" في كل صفحة بياناتها محاكاة.

التبديل لا يمس أي صفحة — `Platform API` (features/platform/data/api.ts) هو
الحاجز الوحيد بين الوضعين.

## 5. ما يعمل فعليًا الآن مقابل ما يحتاج إعدادًا خارجيًا

**جاهز ومُختبر:**
- Types كاملة (TenantProject · ProvisioningJob · SubscriptionActions)
- Schema الـ Control Plane + RLS (supabase/migrations)
- Edge Function كاملة (auth + state machine + Mgmt API client + subscription)
- Dashboard كاملة: تدفق إضافة شركة بتقدم مباشر، تفاصيل مشروع، عمليات
  (verify/reconnect/pause/resume/reprovision)، تحكم اشتراك كامل
- (في demo) — كل التدفقات تعمل محاكاةً بنفس منطق الخادم

**يحتاج إعدادًا خارجيًا (لا بيانات وهمية عنها):**
1. مشروع Supabase للمنصة (Control Plane) — hosting الـ DB + Function.
2. `SUPABASE_ACCESS_TOKEN` — Personal Access Token بصلاحية إنشاء مشاريع.
3. `SUPABASE_ORG_ID` — الـ organization المستهدفة.
4. تطبيق الـ migration + نشر الدالة + أول platform_user (supabase/README.md).
5. نقاط `VERIFY` موسومة في الكود (قيم status الفعلية + endpoint المفاتيح)
   تُثبَّت عند أول استخدام حقيقي للـ Management API.

## 6. نقاط التوسع القادمة (خارج هذه المرحلة)

- تسليم بيانات اتصال الشركة لمستخدميها بعد الدخول (Tenant Session Bridge)
  + bootstrap schema داخل كل مشروع جديد (profiles + أقسام HR).
- مزامنة دورية لحالة المشاريع (cron job يحدّث infra_state/connection).
- فواتير البنية التحتية مقابل حدود الخطط (إنذار قبل التجاوز).
