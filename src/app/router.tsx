/**
 * Router — شجرة الروابط المركزية للنظام.
 *
 * الفصل المعماري الأساسي:
 *   /                 نقطة تمهيدية (حالة الإعداد + روابط المناطق)
 *   /auth/login        المصادقة (نموذج + وضع تجريبي)
 *   /platform/*        منطقة Platform Super Admin — RequireAuth + RequirePlatformAdmin
 *   /app/*             منطقة الشركة — RequireAuth + RequireCompanyUser
 *
 * - ScrollToTop: التمرير يرجع لأعلى عند كل تنقل.
 * - viewTransition على مسارات المناطق: انتقال View Transitions ناعم
 *   (CSS-only على الـ GPU — يتعطل تلقائيًا مع prefers-reduced-motion).
 *
 * ⚠️ الحراس للتجربة فقط — الحماية الفعلية عبر Supabase RLS.
 */

import { BrowserRouter, Route, Routes } from "react-router"

import { PagePlaceholder } from "@/components/page-placeholder"
import { RequireAuth } from "@/components/route-guards/require-auth"
import { RequireCompanyUser } from "@/components/route-guards/require-company-user"
import { RequirePlatformAdmin } from "@/components/route-guards/require-platform-admin"
import { ScrollToTop } from "@/components/scroll-to-top"
import { LoginPage } from "@/features/auth/pages/login"
import { CompanyShell } from "@/features/company/layout/company-shell"
import { CompanyDashboardPage, HrModulePage } from "@/features/company/pages"
import { PlatformShell } from "@/features/platform/layout/platform-shell"
import {
  PlatformCompaniesPage,
  PlatformCompanyDetailPage,
  PlatformDashboardPage,
  PlatformSubscriptionsPage,
  PlatformSystemPage,
} from "@/features/platform/pages"
import { RootIndexPage } from "@/features/root/pages/root-index"

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<RootIndexPage />} />
        <Route path="/auth/login" element={<LoginPage />} />

        {/* ── منطقة المنصة — Platform Super Admin ── */}
        <Route element={<RequireAuth />}>
          <Route element={<RequirePlatformAdmin />}>
            <Route path="/platform" element={<PlatformShell />}>
              <Route
                index
                viewTransition
                element={<PlatformDashboardPage />}
              />
              <Route
                path="companies"
                viewTransition
                element={<PlatformCompaniesPage />}
              />
              <Route
                path="companies/:tenantId"
                viewTransition
                element={<PlatformCompanyDetailPage />}
              />
              <Route
                path="subscriptions"
                viewTransition
                element={<PlatformSubscriptionsPage />}
              />
              <Route
                path="system"
                viewTransition
                element={<PlatformSystemPage />}
              />
            </Route>
          </Route>

          {/* ── منطقة الشركة — Company Admin / Company Users ── */}
          <Route element={<RequireCompanyUser />}>
            <Route path="/app" element={<CompanyShell />}>
              <Route index viewTransition element={<CompanyDashboardPage />} />
              <Route
                path="m/:moduleKey"
                viewTransition
                element={<HrModulePage />}
              />
            </Route>
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <PagePlaceholder
              titleKey="common.notFound"
              descriptionKey="placeholders.futurePhase"
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
