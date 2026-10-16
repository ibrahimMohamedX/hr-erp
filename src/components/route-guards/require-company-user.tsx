/**
 * RequireCompanyUser — يقصر منطقة /app على مستخدمي الشركات
 * (Company Admin أو Company User) مع شركة نشطة فعلًا.
 * يُركب تحت RequireAuth في شجرة الروابط.
 * ⚠️ حارس UX فقط — العزل الفعلي لبيانات كل شركة عبر Supabase RLS.
 */

import { Outlet } from "react-router"

import { PagePlaceholder } from "@/components/page-placeholder"
import { useActiveTenant, useSession } from "@/features/auth/session"

export function RequireCompanyUser() {
  const { session } = useSession()
  const tenant = useActiveTenant()

  if (session) {
    const isCompanyUser =
      session.profile.role === "company_admin" ||
      session.profile.role === "company_user"
    if (!isCompanyUser || !tenant) {
      return <PagePlaceholder titleKey="guards.forbiddenTitle" descriptionKey="guards.forbiddenDescription" />
    }
  }

  return <Outlet />
}
