/**
 * صفحات منطقة الشركة — Placeholders هيكلية.
 * أقسام HR الفعلية (Employees, Attendance, Payroll...) تُبنى في مراحل لاحقة
 * تحت /app/m/:moduleKey بناءً على سجل الأقسام src/config/modules.ts
 */

import { Link, useParams } from "react-router"
import { useTranslation } from "react-i18next"
import { CircleArrowRight } from "lucide-react"

import { PagePlaceholder } from "@/components/page-placeholder"
import { Badge } from "@/components/ui/badge"
import { HR_MODULES } from "@/config/modules"
import type { Locale } from "@/types"

/** لوحة الشركة — مستقبلًا: مؤشرات عامة عن القوى العاملة */
export function CompanyDashboardPage() {
  const { i18n } = useTranslation()
  const locale = (i18n.language?.startsWith("en") ? "en" : "ar") as Locale

  return (
    <PagePlaceholder
      titleKey="nav.company.dashboard"
      descriptionKey="placeholders.companyDashboard"
    >
      <div className="mt-6 flex flex-wrap gap-2">
        {HR_MODULES.map((module) => (
          <Badge key={module.key} variant="outline" asChild>
            <Link to={module.route}>
              {module.name[locale]}
              <CircleArrowRight className="size-3" />
            </Link>
          </Badge>
        ))}
      </div>
    </PagePlaceholder>
  )
}

/** صفحة قسم HR عامة — تعرض تعريف القسم من السجل */
export function HrModulePage() {
  const { i18n } = useTranslation()
  const { moduleKey } = useParams()
  const locale = (i18n.language?.startsWith("en") ? "en" : "ar") as Locale

  const definition = HR_MODULES.find((m) => m.key === moduleKey)
  if (!definition) {
    return <PagePlaceholder titleKey="placeholders.moduleNotFound" />
  }

  return (
    <PagePlaceholder
      titleKey="placeholders.module"
      descriptionKey="placeholders.futurePhase"
    >
      <div className="mt-4 space-y-2">
        <p className="text-h3 font-display">
          {definition.name[locale]}
        </p>
        <p className="text-body text-muted-foreground">
          {definition.description[locale]}
        </p>
        <p className="font-mono text-label text-muted-foreground" dir="ltr">
          key: {definition.key} · route: {definition.route}
        </p>
      </div>
    </PagePlaceholder>
  )
}
