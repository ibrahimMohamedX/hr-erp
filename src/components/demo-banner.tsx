/**
 * DemoBanner — شريط توضيح البيانات التجريبية.
 * يظهر فوق أي صفحة تستهلك بيانات mock (غير مربوطة بقاعدة بيانات فعلية).
 */

import { useTranslation } from "react-i18next"
import { FlaskConical } from "lucide-react"

import { cn } from "@/lib/utils"

export function DemoBanner({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2 text-sm text-muted-foreground",
        className,
      )}
    >
      <FlaskConical className="size-4 shrink-0 text-warn" />
      <span>{t("demo.banner")}</span>
    </div>
  )
}

/** نقطة صغيرة موسومة بلون الحالة — لحالات الاتصال في الجداول */
export function StatusDot({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex size-2 rounded-full", className)} />
  )
}
