/**
 * CompanyShell — الغلاف الهيكلي لمنطقة الشركة (/app).
 * منفصلة تمامًا عن منطقة المنصة. مستقبلًا: Sidebar بأقسام HR من سجل الأقسام
 * (src/config/modules.ts) حسب صلاحيات المستخدم الحالي.
 */

import { Outlet } from "react-router"
import { useTranslation } from "react-i18next"

import { AppToggles } from "@/components/app-toggles"
import { Badge } from "@/components/ui/badge"
import { useActiveTenant } from "@/features/auth/session"

export function CompanyShell() {
  const { t } = useTranslation()
  const tenant = useActiveTenant()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <span className="font-display font-semibold">{t("areas.company")}</span>
          <Badge variant="outline" className="font-mono text-label" dir="ltr">
            {tenant?.slug ?? "tenant"}
          </Badge>
          <div className="ms-auto flex items-center gap-2">
            <AppToggles />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
