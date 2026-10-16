/**
 * سياق الجلسة (Session) — هيكل مبدئي في هذه المرحلة.
 *
 * 🔌 TODO (مرحلة الربط الفعلي):
 *   - ربط Supabase Auth: onAuthStateChange + جلب profile من جدول profiles.
 *   - جلب الشركة النشطة (tenant) من البروفايل.
 *   - عند عدم وجود الجلسة: status = "unauthenticated".
 *
 * حاليًا: Provider نائب يرجع حالة "unauthenticated" دائمًا،
 * وبكده الحراس (Route Guards) يعملوا بشكل هيكلي صحيح: أي زيارة لمنطقة
 * محمية بترجع لصفحة تسجيل الدخول placeholder — بدون أي مصادقة مُزيفة.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react"

import type {
  AppSession,
  RbacContext,
  SessionStatus,
  TenantLite,
} from "@/types"

interface SessionContextValue {
  status: SessionStatus
  session: AppSession | null
  /** سياق جاهز للـ Rules Engine لو الجلسة موجودة */
  rbacContext: RbacContext | null
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  // TODO(auth-phase): استبدال هذا القسم بمنطق Supabase Auth الفعلي.
  const value = useMemo<SessionContextValue>(
    () => ({
      status: "unauthenticated",
      session: null,
      rbacContext: null,
    }),
    [],
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
