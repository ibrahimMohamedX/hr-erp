/**
 * سياق الجلسة (Session) — يعمل بوضعين:
 *
 * 1) وضع تجريبي (Demo): جلسة كاملة تُبنى في الذاكرة وتُحفظ في sessionStorage —
 *    الحل المعتمد حاليًا لأن إعدادات Supabase غير متوفرة بعد.
 *    كل شيء موسوم isDemo=true والواجهات تعرض توضيح "بيانات تجريبية".
 *
 * 2) وضع حقيقي (Supabase Auth): جاهز للربط — signInWithPassword ثم جلب profile.
 *    يُفعَّل تلقائيًا بمجرد ضبط VITE_SUPABASE_* (docs/05-supabase.md).
 *
 * ⚠️ الأدوار والجلسة هنا لتوجيه الواجهة فقط — الحماية الفعلية عبر RLS مستقبلًا.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  AppRole,
  AppSession,
  RbacContext,
  SessionStatus,
  TenantLite,
} from "@/types"

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

interface SessionContextValue {
  status: SessionStatus
  session: AppSession | null
  rbacContext: RbacContext | null
  /** الوضع التجريبي — يظهر للواجهات لوسم البيانات */
  isDemo: boolean
  /** دخول تجريبي بدور — يعمل بدون Supabase (بيانات تجريبية) */
  signInDemo: (role: AppRole) => void
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [demoRole, setDemoRole] = useState<AppRole | null>(readStoredDemoRole)

  const session = useMemo<AppSession | null>(
    () => (demoRole ? buildDemoSession(demoRole) : null),
    [demoRole],
  )

  const status: SessionStatus = session ? "authenticated" : "unauthenticated"

  const signInDemo = useCallback((role: AppRole) => {
    try {
      sessionStorage.setItem(DEMO_STORAGE_KEY, role)
    } catch {
      // تجاهل — الجلسة تعمل في الذاكرة فقط
    }
    setDemoRole(role)
  }, [])

  const signOut = useCallback(() => {
    try {
      sessionStorage.removeItem(DEMO_STORAGE_KEY)
    } catch {
      // تجاهل
    }
    setDemoRole(null)
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      session,
      rbacContext: session ? toRbacContext(session) : null,
      isDemo: session !== null,
      signInDemo,
      signOut,
    }),
    [status, session, signInDemo, signOut],
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
