/**
 * PlatformShell — الهيكل الاحترافي لمنطقة المنصة.
 * Sidebar قابل للطي (icon mode) + متجاوب (Sheet على الموبايل تلقائيًا)
 * + Header بعنوان القسم الحالي وأدوات اللغة/المظهر وقائمة المستخدم.
 */

import { Link, NavLink, Outlet, useLocation } from "react-router"
import { useTranslation } from "react-i18next"
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
} from "lucide-react"

import { AppToggles } from "@/components/app-toggles"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { UserMenu } from "@/components/user-menu"
import { useSession } from "@/features/auth/session"

const NAV = [
  { to: "/platform", icon: LayoutDashboard, key: "nav.platform.dashboard", end: true },
  { to: "/platform/companies", icon: Building2, key: "nav.platform.companies", end: false },
  { to: "/platform/subscriptions", icon: CreditCard, key: "nav.platform.subscriptions", end: false },
  { to: "/platform/system", icon: Activity, key: "nav.platform.system", end: false },
] as const

function pageTitleKey(pathname: string): string {
  if (pathname.startsWith("/platform/companies")) return "nav.platform.companies"
  if (pathname.startsWith("/platform/subscriptions"))
    return "nav.platform.subscriptions"
  if (pathname.startsWith("/platform/system")) return "nav.platform.system"
  return "nav.platform.dashboard"
}

export function PlatformShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const { isDemo } = useSession()

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/platform">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-arc">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="7"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeDasharray="33 11"
                        transform="rotate(-45 12 12)"
                      />
                      <circle cx="12" cy="12" r="2" fill="#C48A5C" />
                    </svg>
                  </span>
                  <span className="flex flex-col gap-0.5 leading-none">
                    <span className="font-latin text-sm font-semibold">
                      Archai HR
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {t("areas.platform")}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("areas.platform")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map(({ to, icon: Icon, key, end }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      asChild
                      tooltip={t(key)}
                      isActive={
                        end
                          ? pathname === to
                          : pathname.startsWith(to)
                      }
                    >
                      <NavLink to={to} end={end}>
                        <Icon />
                        <span>{t(key)}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter>
          <div className="group-data-[collapsible=icon]:hidden px-2 pb-2">
            <Badge
              variant="outline"
              className="w-full justify-center border-warn/40 text-[11px] text-warn"
            >
              {t("demo.badge")}
            </Badge>
            <p className="mt-2 text-center font-mono text-[10px] text-muted-foreground/70">
              v0.2 · Archai HR SaaS
            </p>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger className="-ms-1" />
          <Separator orientation="vertical" className="h-5" />
          <h2 className="font-display text-sm font-semibold">
            {t(pageTitleKey(pathname))}
          </h2>
          <Badge variant="secondary" className="hidden font-latin text-label sm:inline-flex">
            {isDemo ? t("demo.badge") : "LIVE"}
          </Badge>
          <div className="ms-auto flex items-center gap-2">
            <AppToggles />
            <UserMenu />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
