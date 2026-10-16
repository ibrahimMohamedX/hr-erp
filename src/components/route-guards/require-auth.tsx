/**
 * RequireAuth — حارس مستوى تجربة الاستخدام (UX-level) للمسارات المحمية.
 * ⚠️ ليس نظام أمن: الحماية الفعلية عبر Supabase RLS + تحقق الخادم.
 */

import { Navigate, Outlet, useLocation } from "react-router"

import { Skeleton } from "@/components/ui/skeleton"
import { useSession } from "@/features/auth/session"

export function RequireAuth() {
  const { status, session } = useSession()
  const location = useLocation()

  if (status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center p-8">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return <Outlet />
}
