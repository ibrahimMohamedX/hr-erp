# 03 — المستأجرون والمستخدمون والعزل (Tenancy & Users)

> التنفيذ الحالي: `src/types/tenant.ts` · `src/types/user.ts` · `src/features/auth/session.tsx`

## 1. أنواع المستخدمين الثلاثة

| النوع | الدور (`AppRole`) | الشركة (tenant_id) | نطاق الوصول | المنطقة |
|---|---|---|---|---|
| **Platform Super Admin** | `platform_super_admin` | `null` | إدارة المنصة كاملة: الشركات، الاشتراكات، حالة النظام، مستخدمو المنصة | `/platform/*` |
| **Company Admin** | `company_admin` | معرَّف شركة واحدة | إدارة شركته فقط — كل أقسام HR وإعداداتها وقواعدها | `/app/*` |
| **Company User** | `company_user` | معرَّف شركة واحدة | صلاحيات محددة حسب دوره الداخلي وقواعد شركته (`tenant_access_rules`) | `/app/*` |

- **مستخدم المنصة لا يملك `tenant_id`** — لا يرى أي بيانات أعمال شركات حتى لو أخطأت الواجهة؛ الـ RLS يحصره في جداول المنصة فقط (`platform:*`).
- **مستخدم الشركة لا يرى `/platform` إطلاقًا** — الحارس يمنعه في الواجهة، والـ RLS يمنعه فعليًا في أي استعلام.
- ضمن `company_user` توجد أدوار داخلية (`CompanyInternalRole`: `hr_manager`, `hr_specialist`, `team_lead`, `employee`) — تُستخدم للقواعد الدقيقة مستقبلًا، وليست أدوارًا معمارية.

## 2. نموذج العزل (Shared DB + tenant_id + RLS)

- كل جدول أعمال يحمل `tenant_id NOT NULL REFERENCES companies(id)`.
- كل سياسة RLS على جداول الأعمال: **القراءة والكتابة داخل نطاق الشركة الحالية فقط** — المشتقة من الـ JWT (profile.tenant_id) وليس من أي مدخل عميل.
- عمليات المنصة (عرض الشركات، الاشتراكات...) تعمل عبر جداول منصة مستقلة بسياسات دور `platform_super_admin`.
- **قراءة مستخدم لشركة أخرى مستحيلة حتى لو حاول تجاوز الواجهة** — هذا هو الفرق الجوهري بين عزل RLS وإخفاء الواجهة.

## 3. دورة الجلسة المستقبلية (Wire-up Phase)

```
تسجيل دخول (Supabase Auth)
  └─► onAuthStateChange في SessionProvider
       └─► جلب profile (بواسطة auth.uid()) → role + tenant_id
            └─► جلب الشركة النشطة (companies) للـ company users
                 └─► Session = { user, profile, tenant }
                      ├─► الـ Route Guards توجه حسب الدور
                      └─► useCan/evaluateAccess يضبط العرض حسب القواعد
```

الحالة الحالية للهيكل: `SessionProvider` نائب يرجع `unauthenticated` — لا توجد مصادقة مُزيفة، والحراس تعمل بشكل هيكلي صحيح (زيارة `/platform` قبل الربط → تحويل لـ `/auth/login`).

## 4. توسعات مستقبلية مدروسة (خارج نطاق هذه المرحلة)

- **عضوية متعددة الشركات لمستخدم واحد:** جدول `tenant_members` يفصل المستخدم عن الشركة، مع **مبدّل شركة** في الواجهة (company switcher). الأنواع الحالية مهيأة لذلك دون كسر (`profile.tenant_id` يتحول لـ "الشركة النشطة").
- **دعوات وتفعيل مستخدمين:** flow دعوة عبر بريد (`user_invitations`) مع تفعيل من Company Admin.
- **مقاعد الاشتراك:** عدد المقاعد من `subscriptions.seats` يحد عدد المستخدمين النشطين لكل شركة.
