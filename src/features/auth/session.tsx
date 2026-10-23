/**
 * سياق الجلسة (Session) — أربعة مسارات:
 *
 * 1) جلسة المنصة الحقيقية (Platform Auth): دخول Super Admin عبر مشروع
 *    المنصة (Supabase Auth + جدول platform_users) — يتفعّل تلقائيًا عند ضبط
 *    VITE_PLATFORM_SUPABASE_*. العميل يحفظ الجلسة بنفسه في localStorage
 *    (persistSession) فتنجو من أي refresh.
 *
 * 2) جلسة الشركة الحقيقية (Tenant Auth): دخول مسؤول الشركة عبر مشروع
 *    الشركة نفسه (VITE_SUPABASE_* — DB-per-tenant) — Supabase Auth + صف
 *    profiles داخل المشروع. العزل فيزيائي: المشروع نفسه هو حدود الشركة.
 *
 * 3) وضع تجريبي (Demo): جلسة كاملة تُبنى في الذاكرة وتُحفظ في sessionStorage —
 *    لأدوار الشركة عندما لا يكون مشروعها مضبوطًا. موسومة isDemo=true.
 *
 * 4) لا جلسة: unauthenticated → الحراس تحوّل لصفحة الدخول.
 *
 * ⚠️ الأدوار والجلسة هنا لتوجيه الواجهة فقط — الحماية الفعلية عبر RLS.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  AppRole,
  AppSession,
  RbacContext,
  SessionStatus,
  UserProfile,
} from "@/types"
import type { TenantLite } from "@/types"
import {
  getPlatformClient,
  isPlatformBackendConfigured,
} from "@/lib/platform/client"
import { getSupabaseClientOrNull } from "@/lib/supabase/client"
import { isSupabaseConfigured } from "@/lib/supabase/config"

const DEMO_STORAGE_KEY = "archai:demo-session"

/** الشركة التجريبية — مصدر بيانات قسم الشركة في الوضع الحالي */
export const DEMO_TENANT: TenantLite = {
  id: "demo-tenant-nawa",
  slug: "nawa-tech",
  name: "نُوى تك",
  status: "active",
  connection_state: "connected",
}

interface DemoIdentity {
  email: string
  fullName: string
  companyRole: "hr_manager" | "hr_specialist" | "team_lead" | "employee" | null
  tenant: TenantLite | null
}

const DEMO_IDENTITIES: Record<AppRole, DemoIdentity> = {
  platform_super_admin: {
    email: "platform.admin@archai.demo",
    fullName: "مدير المنصة",
    companyRole: null,
    tenant: null,
  },
  company_admin: {
    email: "ahmed@nawa-tech.demo",
    fullName: "أحمد سامي",
    companyRole: "hr_manager",
    tenant: DEMO_TENANT,
  },
  company_user: {
    email: "mona@nawa-tech.demo",
    fullName: "منى عبد الرحمن",
    companyRole: "hr_specialist",
    tenant: DEMO_TENANT,
  },
}

function buildDemoSession(role: AppRole): AppSession {
  const identity = DEMO_IDENTITIES[role]
  const now = new Date().toISOString()

  return {
    user: { id: `demo-${role}`, email: identity.email },
    profile: {
      id: `demo-profile-${role}`,
      created_at: now,
      updated_at: now,
      user_id: `demo-${role}`,
      tenant_id: identity.tenant?.id ?? null,
      full_name: identity.fullName,
      role,
      company_role: identity.companyRole,
      avatar_url: null,
      status: "active",
    },
    tenant: identity.tenant,
  }
}

function toRbacContext(session: AppSession): RbacContext {
  return {
    userId: session.user.id,
    role: session.profile.role,
    tenantId: session.profile.tenant_id,
  }
}

/** نتيجة دخول المنصة الحقيقي */
export interface PlatformSignInResult {
  ok: boolean
  message?: string
}

/** نتيجة دخول مسؤول الشركة الحقيقي (عبر مشروع الشركة نفسه) */
export interface CompanySignInResult {
  ok: boolean
  message?: string
}

interface SessionContextValue {
  status: SessionStatus
  session: AppSession | null
  rbacContext: RbacContext | null
  /** جلسة تجريبية — الواجهات تعرض وسوم "بيانات تجريبية" */
  isDemo: boolean
  /** دخول تجريبي بدور — يعمل بدون Supabase (بيانات تجريبية) */
  signInDemo: (role: AppRole) => void
  /** دخول Super Admin حقيقي عبر مشروع المنصة (Supabase Auth) */
  signInPlatform: (email: string, password: string) => Promise<PlatformSignInResult>
  /** دخول مسؤول الشركة حقيقي عبر مشروع الشركة نفسه (Supabase Auth + profiles) */
  signInCompany: (email: string, password: string) => Promise<CompanySignInResult>
  signOut: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readStoredDemoRole(): AppRole | null {
  try {
    const raw = sessionStorage.getItem(DEMO_STORAGE_KEY)
    if (raw === "platform_super_admin" || raw === "company_admin" || raw === "company_user") {
      return raw
    }
  } catch {
    // sessionStorage غير متاح — تجاهل
  }
  return null
}

/** بناء جلسة Super Admin حقيقية من صف platform_users */
function buildPlatformSession(
  userId: string,
  email: string,
  profile: { full_name: string; role: string; created_at: string },
): AppSession {
  const now = new Date().toISOString()
  const userProfile: UserProfile = {
    id: userId,
    created_at: profile.created_at ?? now,
    updated_at: now,
    user_id: userId,
    tenant_id: null,
    full_name: profile.full_name || email,
    role: "platform_super_admin",
    company_role: null,
    avatar_url: null,
    status: "active",
  }
  return {
    user: { id: userId, email },
    profile: userProfile,
    tenant: null,
  }
}

/** صف profiles كما يأتي من مشروع الشركة (نواة tenant-schema) */
interface TenantProfileRow {
  full_name: string
  role: string
  created_at: string
}

/**
 * بناء جلسة شركة حقيقية من صف profiles داخل مشروع الشركة.
 * العزل هنا فيزيائي (DB-per-tenant): المشروع نفسه هو حدود الشركة،
 * لذا tenant_id قيمة تعريفية للربط الداخلي فقط ("live").
 * اسم الشركة الحقيقي يُربط لاحقًا عبر الـ Control Plane/SSO.
 */
function buildCompanySession(
  userId: string,
  email: string,
  profile: TenantProfileRow,
): AppSession {
  const now = new Date().toISOString()
  const role: AppRole =
    profile.role === "company_admin" ? "company_admin" : "company_user"
  const userProfile: UserProfile = {
    id: userId,
    created_at: profile.created_at ?? now,
    updated_at: now,
    user_id: userId,
    tenant_id: "live",
    full_name: profile.full_name || email,
    role,
    company_role: null,
    avatar_url: null,
    status: "active",
  }
  return {
    user: { id: userId, email },
    profile: userProfile,
    tenant: null,
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoRole, setDemoRole] = useState<AppRole | null>(readStoredDemoRole)
  const [realSession, setRealSession] = useState<AppSession | null>(null)
  const [bootStatus, setBootStatus] = useState<SessionStatus>(
    isPlatformBackendConfigured() || isSupabaseConfigured()
      ? "loading"
      : "unauthenticated",
  )

  // ── الإقلاع: demo أولًا، ثم المنصة الحقيقية، ثم مشروع الشركة ────────────
  useEffect(() => {
    if (demoRole) {
      setBootStatus("authenticated")
      return
    }

    void (async () => {
      // 1) جلسة المنصة (Control Plane) — Super Admin
      const platformClient = getPlatformClient()
      if (platformClient) {
        try {
          const { data: authData } = await platformClient.auth.getSession()
          const user = authData.session?.user
          if (user) {
            // جدول platform_users — لو الـ migration غير مطبق أو المستخدم
            // غير مسجل: ننهي الجلسة ونكمل (العميل يحفظ التوكنات بنفسه)
            const { data: profile } = await platformClient
              .from("platform_users")
              .select("full_name, role, created_at")
              .eq("user_id", user.id)
              .maybeSingle()

            if (profile) {
              setRealSession(
                buildPlatformSession(user.id, user.email ?? "", profile as {
                  full_name: string
                  role: string
                  created_at: string
                }),
              )
              setBootStatus("authenticated")
              return
            }
            await platformClient.auth.signOut()
          }
        } catch {
          // نكمل لفحص الشركة — فشل المنصة لا يمنع دخول الشركة
        }
      }

      // 2) جلسة الشركة — مشروع الشركة المستقل (VITE_SUPABASE_*)
      const companyClient = getSupabaseClientOrNull()
      if (companyClient) {
        try {
          const { data: companyAuth } = await companyClient.auth.getSession()
          const companyUser = companyAuth.session?.user
          if (companyUser) {
            const { data: companyProfile } = await companyClient
              .from("profiles")
              .select("full_name, role, created_at")
              .eq("user_id", companyUser.id)
              .maybeSingle()

            if (companyProfile) {
              setRealSession(
                buildCompanySession(
                  companyUser.id,
                  companyUser.email ?? "",
                  companyProfile as TenantProfileRow,
                ),
              )
              setBootStatus("authenticated")
              return
            }
            await companyClient.auth.signOut()
          }
        } catch {
          // نكمل إلى unauthenticated
        }
      }

      setBootStatus("unauthenticated")
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const session = useMemo<AppSession | null>(
    () => (demoRole ? buildDemoSession(demoRole) : realSession),
    [demoRole, realSession],
  )

  const status: SessionStatus =
    demoRole || realSession ? "authenticated" : bootStatus

  const signInDemo = useCallback((role: AppRole) => {
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, role)
    } catch {
      // تجاهل — الجلسة تعمل في الذاكرة فقط
    }
    setDemoRole(role)
  }, [])

  /** دخول Super Admin حقيقي: Supabase Auth + تحقق من platform_users */
  const signInPlatform = useCallback(
    async (email: string, password: string): Promise<PlatformSignInResult> => {
      const client = getPlatformClient()
      if (!client) {
        return { ok: false, message: "platform_not_configured" }
      }

      const { data: authData, error: authError } =
        await client.auth.signInWithPassword({ email, password })
      if (authError || !authData.user) {
        return { ok: false, message: authError?.message ?? "invalid_credentials" }
      }

      // تحقق الدور: لازم يكون مسجلًا في platform_users
      const { data: profile, error: profileError } = await client
        .from("platform_users")
        .select("full_name, role, created_at")
        .eq("user_id", authData.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        // ليس مدير منصة: أنهِ الجلسة فورًا — لا دور له في المنصة
        await client.auth.signOut()
        return { ok: false, message: "platform_admin_required" }
      }

      setRealSession(
        buildPlatformSession(authData.user.id, authData.user.email ?? email, profile as {
          full_name: string
          role: string
          created_at: string
        }),
      )
      setBootStatus("authenticated")
      return { ok: true }
    },
    [],
  )

  /** دخول مسؤول الشركة الحقيقي: Supabase Auth لمشروع الشركة + تحقق profiles */
  const signInCompany = useCallback(
    async (email: string, password: string): Promise<CompanySignInResult> => {
      const client = getSupabaseClientOrNull()
      if (!client) {
        return { ok: false, message: "company_not_configured" }
      }

      const { data: authData, error: authError } =
        await client.auth.signInWithPassword({ email, password })
      if (authError || !authData.user) {
        return { ok: false, message: authError?.message ?? "invalid_credentials" }
      }

      // تحقق الصف: لازم يكون له صف profiles داخل مشروع الشركة
      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("full_name, role, created_at")
        .eq("user_id", authData.user.id)
        .maybeSingle()

      if (profileError || !profile) {
        // ليس من مستخدمي هذه الشركة: أنهِ الجلسة فورًا
        await client.auth.signOut()
        return { ok: false, message: "company_profile_required" }
      }

      setRealSession(
        buildCompanySession(
          authData.user.id,
          authData.user.email ?? email,
          profile as TenantProfileRow,
        ),
      )
      setBootStatus("authenticated")
      return { ok: true }
    },
    [],
  )

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(DEMO_STORAGE_KEY)
    } catch {
      // تجاهل
    }
    setDemoRole(null)
    setRealSession(null)
    setBootStatus("unauthenticated")

    // إنهاء الجلسات الحقيقية أيضًا (لو وُجدت)
    const platformClient = getPlatformClient()
    if (platformClient) {
      void platformClient.auth.signOut()
    }
    const companyClient = getSupabaseClientOrNull()
    if (companyClient) {
      void companyClient.auth.signOut()
    }
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      rbacContext: session ? toRbacContext(session) : null,
      isDemo: demoRole !== null,
      signInDemo,
      signInPlatform,
      signInCompany,
      signOut,
    }),
    [status, session, demoRole, signInDemo, signInPlatform, signInCompany, signOut],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

/** القراءة الموحدة لحالة الجلسة */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within <SessionProvider>")
  }
  return ctx
}

/** هل المستخدم الحالي Platform Super Admin؟ */
export function useIsPlatformAdmin(): boolean {
  const { session } = useSession()
  return session?.profile.role === "platform_super_admin"
}

/** الشركة النشطة — null لمستخدم المنصة أو قبل تسجيل الدخول */
export function useActiveTenant(): TenantLite | null {
  const { session } = useSession()
  return session?.tenant ?? null
}

/** توجيه المستخدم بعد الدخول حسب دوره */
export function homeRouteForRole(role: AppRole): string {
  return role === "platform_super_admin" ? "/platform" : "/app"
}
