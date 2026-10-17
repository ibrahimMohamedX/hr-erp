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
import { ArchaiMark } from "@/components/archai-mark"
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
import { useDocumentTitle } from "@/hooks/use-document-title"

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
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const { isDemo } = useSession()

  const sectionTitle = t(pageTitleKey(pathname))
  useDocumentTitle(sectionTitle)

  // الـ Sidebar يتبع الاتجاه: يمين في RTL · يسار في LTR
  const side = i18n.dir() === "rtl" ? "right" : "left"

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" side={side}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/platform">
                  <ArchaiMark />
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
            {sectionTitle}
          </h2>
          <Badge variant="secondary" className="hidden font-latin text-label sm:inline-flex">
            {isDemo ? t("demo.badge") : "LIVE"}
          </Badge>
          <div className="ms-auto flex items-center gap-2">
            <AppToggles />
            <UserMenu />
          </div>
        </header>

        {/* key=path يعيد حركة الدخول مع كل تنقل داخل المنطقة */}
        <main className="flex-1 p-4 md:p-6">
          <div key={pathname} className="animate-in-up">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
