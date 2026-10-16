/**
 * PlatformShell — الغلاف الهيكلي لمنطقة المنصة (/platform).
 * منطقة منفصلة تمامًا عن واجهة الشركة: navigation مستقل ومستقبلًا Sidebar خاص.
 */

import { Link, Outlet } from "react-router"
import { useTranslation } from "react-i18next"

import { AppToggles } from "@/components/app-toggles"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

const PLATFORM_NAV = [
  { to: "/platform", key: "nav.platform.dashboard" },
  { to: "/platform/companies", key: "nav.platform.companies" },
  { to: "/platform/subscriptions", key: "nav.platform.subscriptions" },
  { to: "/platform/system", key: "nav.platform.system" },
] as const

export function PlatformShell() {
  const { t } = useTranslation()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <Link to="/platform" className="font-display font-semibold">
            {t("areas.platform")}
          </Link>
          <Badge variant="outline" className="font-latin text-label">
            SUPER ADMIN
          </Badge>
          <Separator orientation="vertical" className="h-5" />
          <nav className="flex items-center gap-1">
            {PLATFORM_NAV.map((item) => (
              <ButtonGhost key={item.to} to={item.to} label={t(item.key)} />
            ))}
          </nav>
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

function ButtonGhost({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {label}
    </Link>
  )
}
