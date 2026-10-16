/**
 * RequirePlatformAdmin — يقصر منطقة /platform على Platform Super Admin.
 * يُركب تحت RequireAuth في شجرة الروابط.
 * ⚠️ حارس UX فقط — على الخادم، سياسات RLS هي من يمنع فعليًا.
 */

import { Outlet } from "react-router"

import { PagePlaceholder } from "@/components/page-placeholder"
import { useIsPlatformAdmin, useSession } from "@/features/auth/session"

export function RequirePlatformAdmin() {
  const { session } = useSession()
  const isPlatformAdmin = useIsPlatformAdmin()

  if (session && !isPlatformAdmin) {
    return <PagePlaceholder titleKey="guards.forbiddenTitle" descriptionKey="guards.forbiddenDescription" />
  }

  return <Outlet />
}
