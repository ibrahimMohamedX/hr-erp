/**
 * Barrel صفحات منطقة الشركة + مُوجِّه صفحة القسم العام.
 *
 * المسار /app/m/:moduleKey يوجّه حسب مفتاح القسم:
 * الأقسام المنفذة → صفحاتها الفعلية، وإلا → صفحة "قيد الإنشاء" الاحترافية.
 */

import { Link, useParams } from "react-router"
import { useTranslation } from "react-i18next"

import { PagePlaceholder } from "@/components/page-placeholder"
import { isHrModuleKey, type HrModuleKey } from "@/types"

import { AttendancePage } from "./attendance"
import { CompanyDashboardPage } from "./dashboard"
import { DepartmentsPage } from "./departments"
import { EmployeeProfilePage } from "./employee-profile"
import { EmployeesPage } from "./employees"
import { LeavesPage } from "./leaves"
import { ModuleUnderConstructionPage } from "./module-under-construction"

export { CompanyDashboardPage, EmployeeProfilePage, EmployeesPage }

/** صفحة القسم العام — تُستخدم في المسار /app/m/:moduleKey */
export function HrModulePage() {
  const params = useParams()
  const moduleKeyParam = params.moduleKey

  if (!moduleKeyParam || !isHrModuleKey(moduleKeyParam)) {
    return <PagePlaceholder titleKey="placeholders.moduleNotFound" />
  }

  const moduleKey: HrModuleKey = moduleKeyParam

  switch (moduleKey) {
    case "employees":
      return <EmployeesPage />
    case "attendance":
      return <AttendancePage />
    case "leaves":
      return <LeavesPage />
    case "departments":
      return <DepartmentsPage />
    default:
      return <ModuleUnderConstructionPage moduleKey={moduleKey} />
  }
}

/** رابط تراجع سريع — يُستخدم في صفحات الأخطاء مستقبلًا */
export function BackToDashboardLink() {
  const { t } = useTranslation()
  return <Link to="/app">{t("nav.company.dashboard")}</Link>
}
