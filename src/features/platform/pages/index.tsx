/**
 * صفحات منطقة المنصة — كلها Placeholders هيكلية في هذه المرحلة.
 * الوظائف الفعلية (جلب الشركات من Supabase، إدارة الاشتراكات...) مراحل لاحقة.
 * docs/07-roadmap.md يوضح الترتيب.
 */

import { useParams } from "react-router"

import { PagePlaceholder } from "@/components/page-placeholder"

/** لوحة المنصة — نظرة عامة على الشركات وحالة النظام */
export function PlatformDashboardPage() {
  return (
    <PagePlaceholder
      titleKey="nav.platform.dashboard"
      descriptionKey="placeholders.platformDashboard"
    />
  )
}

/** قائمة الشركات المسجلة والمتصلة وحالة كل شركة */
export function PlatformCompaniesPage() {
  return (
    <PagePlaceholder
      titleKey="nav.platform.companies"
      descriptionKey="placeholders.companies"
    />
  )
}

/** تفاصيل شركة واحدة + مستخدميها واستخدامها */
export function PlatformCompanyDetailPage() {
  const { tenantId } = useParams<{ tenantId: string }>()

  return (
    <PagePlaceholder
      titleKey="nav.platform.companies"
      descriptionKey="placeholders.companyDetail"
    >
      <p className="mt-4 font-mono text-label text-muted-foreground" dir="ltr">
        tenant_id: {tenantId ?? "—"}
      </p>
    </PagePlaceholder>
  )
}

/** متابعة الاشتراكات والخطط */
export function PlatformSubscriptionsPage() {
  return (
    <PagePlaceholder
      titleKey="nav.platform.subscriptions"
      descriptionKey="placeholders.subscriptions"
    />
  )
}

/** حالة النظام ومؤشراته */
export function PlatformSystemPage() {
  return (
    <PagePlaceholder
      titleKey="nav.platform.system"
      descriptionKey="placeholders.system"
    />
  )
}
