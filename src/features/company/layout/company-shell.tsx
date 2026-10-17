/**
 * CompanyShell — الهيكل الاحترافي لمنطقة الشركة.
 * الـ Sidebar يُبنى ديناميكيًا من سجل الأقسام (src/config/modules.ts)
 * **مفلترًا بصلاحيات المستخدم الحالي** — عرض قسم HR يتطلب module:<key>:view.
 * (لو صلاحيات العرض هنا لتحسين التجربة — الـ RLS هو الحصن الفعلي مستقبلًا)
 */

import { useMemo } from "react"
import { Link, NavLink, Outlet, useLocation } from "react-router"
import { useTranslation } from "react-i18next"
import { LayoutDashboard } from "lucide-react"

import { AppToggles } from "@/components/app-toggles"
import { ArchaiMark } from "@/components/archai-mark"
import { ModuleIcon } from "@/components/module-icon"
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
import { useActiveTenant, useSession } from "@/features/auth/session"
import { HR_MODULES } from "@/config/modules"
import { canAccess } from "@/lib/rbac/evaluate"
import { permission } from "@/lib/rbac/permissions"
import { useDocumentTitle } from "@/hooks/use-document-title"
import type { HrModuleKey, Locale } from "@/types"

/** الأقسام المسموح عرضها للمستخدم الحالي حسب الـ RBAC */
function useAllowedModules() {
  const { rbacContext } = useSession()

  return useMemo(
    () =>
      HR_MODULES.filter((module) =>
        rbacContext
          ? canAccess(rbacContext, permission(`module:${module.key}`, "view"))
          : false,
      ),
    [rbacContext],
  )
}

/** عنوان القسم الحالي من المسار — لعنوان المتصفح */
function useSectionTitle(locale: Locale, pathname: string): string {
  const { t } = useTranslation()

  return useMemo(() => {
    if (pathname === "/app") return t("nav.company.dashboard")
    const match = pathname.match(/^\/app\/m\/([^/]+)/)
    if (match) {
      const found = HR_MODULES.find((m) => m.key === match[1])
      if (found) return found.name[locale]
    }
    return t("areas.company")
  }, [t, locale, pathname])
}

export function CompanyShell() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const tenant = useActiveTenant()
  const { session } = useSession()
  const allowedModules = useAllowedModules()

  const locale = (i18n.language?.startsWith("en") ? "en" : "ar") as Locale
  const sectionTitle = useSectionTitle(locale, pathname)
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
                <Link to="/app">
                  <ArchaiMark />
                  <span className="flex min-w-0 flex-col gap-0.5 leading-none">
                    <span className="truncate text-sm font-semibold">
                      {tenant?.name ?? t("areas.company")}
                    </span>
                    <span
                      className="truncate font-mono text-[10px] text-muted-foreground"
                      dir="ltr"
                    >
                      {tenant?.slug ?? "workspace"}
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{t("areas.company")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    tooltip={t("nav.company.dashboard")}
                    isActive={pathname === "/app"}
                  >
                    <NavLink to="/app" end>
                      <LayoutDashboard />
                      <span>{t("nav.company.dashboard")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>{t("company.modulesLabel")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {allowedModules.map((module) => (
                  <SidebarMenuItem key={module.key}>
                    <SidebarMenuButton
                      asChild
                      tooltip={module.name[locale]}
                      isActive={pathname === module.route}
                    >
                      <NavLink to={module.route}>
                        <ModuleIcon name={module.icon} />
                        <span>{module.name[locale]}</span>
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
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-sm font-semibold">
              {tenant?.name ?? t("areas.company")}
            </span>
            <Badge variant="secondary" className="hidden text-[11px] sm:inline-flex">
              {t(`roles.${session?.profile.role ?? "company_user"}`)}
            </Badge>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <AppToggles />
            <UserMenu />
          </div>
        </header>

        {/* key=path يعيد حركة الدخول مع كل تنقل بين الأقسام */}
        <main className="flex-1 p-4 md:p-6">
          <div key={pathname} className="animate-in-up">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
