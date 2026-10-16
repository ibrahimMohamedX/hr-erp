# 04 — Rules & Permissions Engine — التصميم

> التنفيذ الحالي (الأساس): `src/types/rbac.ts` · `src/lib/rbac/permissions.ts` · `src/lib/rbac/evaluate.ts`
> ⚠️ فحص الواجهة = تجربة استخدام فقط. الحماية الفعلية: **Supabase RLS** + تحقق الخادم.

## 1. صيغة الصلاحيات (Permission String)

ثلاثة مقاطع: `scope:target:action`

| Scope | أمثلة | الاستخدام |
|---|---|---|
| `module:*` | `module:employees:view` · `module:leaves:approve` | أقسام HR داخل الشركة |
| `platform:*` | `platform:tenants:manage` · `platform:subscriptions:administer` | إدارة المنصة فقط |
| `company:*` | `company:rules:manage` · `company:settings:update` | إعدادات الشركة وقواعدها |

**الأفعال المعتمدة:** `view · create · update · delete · approve · export · manage · administer`

**الأنماط (Patterns):** تُستخدم في الافتراضات فقط — `module:*:view` · `platform:*:*` · `company:settings:*`

## 2. الأدوار والافتراضات (`ROLE_PERMISSION_DEFAULTS`)

| الدور | الافتراض | قابلية التخصيص |
|---|---|---|
| `platform_super_admin` | `platform:*:*` — موارد المنصة فقط، **صفر وصول لبيانات أقسام HR** | لا (ثابت معماريًا) |
| `company_admin` | `module:*:*` + `company:*:*` | قواعد deny فردية تضيّق نطاقًا معينًا |
| `company_user` | مجموعة بداية محدودة (view/create أساسي) | توسيع/تضييق كامل بقواعد role/user |

الافتراضات **نقطة بداية فقط** — القواعد المخصصة لكل شركة تضيف فوقها أو تمنع (deny) تحتها.

## 3. قواعد الوصول (`tenant_access_rules` — future)

```ts
{ id, tenant_id, scope: 'role' | 'user', effect: 'allow' | 'deny',
  resource, action, priority, enabled }
```

- **scope: `role`** — قاعدة لكل حاملي دور داخل الشركة. مثل: «`hr_manager` يعتمد الإجازات».
- **scope: `user`** — قاعدة لمستخدم بعينه. مثل: «المستخدم (س) يصدّر تقرير الرواتب».
- **priority** — عند تعارض قواعد متعددة على نفس المورد/الفعل: الأعلى أولوية يفصل أولًا.
- **tenant_id** على كل قاعدة — قواعد شركة لا تعمل على غيرها (وفضلًا تفرض بـ RLS أيضًا).

## 4. ترتيب التقييم (`evaluateAccess` — منفذ حاليًا)

```
1) قواعد المستخدم (scope=user)  — بالأولوية الأعلى أولًا → أول مطابقة تحسم
2) قواعد الدور    (scope=role)  — نفس المنطق
3) الافتراضات حسب الدور (الأنماط) → سماح إن طابقت
4) منع افتراضي (default_deny)
```

- القرار يحمل **مصدره** (`user_rule | role_rule | role_default | default_deny`) — للـ observability والتشخيح.
- قاعدة `deny` تصل نفس قوة `allow` — الترتيب والأولوية يحددان الحسم (لا أفضلية تلقائية للسماح).
- `action: '*'` على المورد = كل الأفعال؛ المورد نفسه محدد دائمًا (لا wildcard موارد في القواعد).

## 5. القواعد التشغيلية (`tenant_operational_rules` — future)

**ليست صلاحيات** — إعدادات عمل قابلة للتخصيص لكل شركة، مثل:

| المفتاح | مثال قيمة | القسم المستهلك |
|---|---|---|
| `leaves.max_annual_balance` | `21` | Leaves |
| `leaves.carryover.enabled` | `true` | Leaves |
| `attendance.grace_period_minutes` | `10` | Attendance |
| `attendance.overtime.enabled` | `true` | Attendance |
| `payroll.currency` | `"EGP"` | Payroll |

القراءة مستقبلًا عبر TanStack Query من جدول القواعد (مع cache لكل مفتاح) — الأقسام تستهلكها دون معرفة مصدرها.

## 6. المتبقي للمراحل القادمة (خارج هذه المرحلة)

- جلب القواعد من الخادم وربطها في `useCan` تلقائيًا (بدل المعامل اليدوي).
- شروط ديناميكية (Conditions DSL): مثل «الموافقة على إجازة الموظفين التابعين لقسمي فقط» — عبر join بنيوي على الخادم مع RLS.
- قواعد حسب `company_role` الداخلية.
- واجهة إدارة القواعد (قسم Permissions) + تزامن القواعد مع سياسات RLS/RPC.
- `listEffectivePermissions` على مستوى العقد (`RulesEngine` interface) — لتوليد قوائم القدرات دفعة واحدة.
