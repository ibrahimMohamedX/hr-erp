/**
 * StatusBadge — وسم حالة الموظف الوظيفية بألوان الحالة المعتمدة.
 * مشترك بين قائمة الموظفين وملف الموظف الشخصي.
 */

import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { EmployeeStatus } from "@/types"

const employeeStatusStyles: Record<EmployeeStatus, string> = {
  active: "border-ok/40 text-ok",
  probation: "border-arc/40 text-arc",
  suspended: "border-warn/50 text-warn",
  terminated: "border-muted-foreground/30 text-muted-foreground",
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px]", employeeStatusStyles[status])}
    >
      {t(`employee.status.${status}`)}
    </Badge>
  )
}
