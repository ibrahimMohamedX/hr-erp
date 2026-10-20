/**
 * سياق الجلسة (Session) — ثلاثة مسارات:
 *
 * 1) وضع حقيقي (Platform Auth): دخول Super Admin عبر مشروع المنصة
 *    (Supabase Auth + جدول platform_users) — يتفعّل تلقائيًا عند ضبط
 *    VITE_PLATFORM_SUPABASE_*. العميل يحفظ الجلسة بنفسه في localStorage
 *    (persistSession) فتنجو من أي refresh.
 *
 * 2) وضع تجريبي (Demo): جلسة كاملة تُبنى في الذاكرة وتُحفظ في sessionStorage —
 *    لأدوار الشركة حتى يتوفر مشروعها المستقل. موسومة isDemo=true.
 *
 * 3) لا جلسة: unauthenticated → الحراس تحوّل لصفحة الدخول.
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoRole, setDemoRole] = useState<AppRole | null>(readStoredDemoRole)
  const [realSession, setRealSession] = useState<AppSession | null>(null)
  const [bootStatus, setBootStatus] = useState<SessionStatus>(
    isPlatformBackendConfigured() ? "loading" : "unauthenticated",
  )

  // ── الإقلاع: demo أولًا، ثم فحص جلسة المنصة الحقيقية ────────────────────
  useEffect(() => {
    if (demoRole) {
      setBootStatus("authenticated")
      return
    }
    const client = getPlatformClient()
    if (!client) {
      setBootStatus("unauthenticated")
      return
    }

    void (async () => {
      try {
        const { data: authData } = await client.auth.getSession()
        const user = authData.session?.user
        if (!user) {
          setBootStatus("unauthenticated")
          return
        }

        // جدول platform_users — لو الـ migration غير مطبق أو المستخدم
        // غير مسجل: ننهي الجلسة ونرجع للدخول (العميل يحفظ التوكنات بنفسه)
        const { data: profile, error: profileError } = await client
          .from("platform_users")
          .select("full_name, role, created_at")
          .eq("user_id", user.id)
          .maybeSingle()

        if (profileError || !profile) {
          await client.auth.signOut()
          setBootStatus("unauthenticated")
          return
        }

        setRealSession(
          buildPlatformSession(user.id, user.email ?? "", profile as {
            full_name: string
            role: string
            created_at: string
          }),
        )
        setBootStatus("authenticated")
      } catch {
        setBootStatus("unauthenticated")
      }
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

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(DEMO_STORAGE_KEY)
    } catch {
      // تجاهل
    }
    setDemoRole(null)
    setRealSession(null)
    setBootStatus("unauthenticated")

    // إنهاء جلسة المنصة الحقيقية أيضًا (لو موجودة)
    const client = getPlatformClient()
    if (client) {
      void client.auth.signOut()
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
      signOut,
    }),
    [status, session, demoRole, signInDemo, signInPlatform, signOut],
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
