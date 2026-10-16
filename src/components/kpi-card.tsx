/**
 * KpiCard — بطاقة مؤشر أداء بهوية Archai:
 * أيقونة داخل شريحة ملونة حسب النبرة + قيمة كبيرة (أرقام لاتينية) + عنوان + اتجاه اختياري.
 */

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Tone = "arc" | "copper" | "ok" | "warn" | "error" | "neutral"

const toneStyles: Record<Tone, { chip: string; value?: string }> = {
  arc: {
    chip: "bg-arc/12 text-arc border-arc/25",
  },
  copper: {
    chip: "bg-copper/12 text-copper border-copper/25",
  },
  ok: {
    chip: "bg-ok/12 text-ok border-ok/25",
  },
  warn: {
    chip: "bg-warn/12 text-warn border-warn/25",
  },
  error: {
    chip: "bg-error/12 text-error border-error/25",
  },
  neutral: {
    chip: "bg-muted text-muted-foreground border-border",
  },
}

export interface KpiCardProps {
  title: string
  value: ReactNode
  icon: LucideIcon
  tone?: Tone
  /** مثل "+12% عن الشهر الماضي" */
  trend?: {
    label: string
    positive?: boolean
  }
  hint?: string
}

export function KpiCard({
  title,
  value,
  icon: Icon,
  tone = "arc",
  trend,
  hint,
}: KpiCardProps) {
  return (
    <Card className="gap-0 py-0 transition-colors hover:border-arc/35">
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl border",
            toneStyles[tone].chip,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{title}</p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span
              className="font-latin text-2xl font-semibold tracking-tight"
              dir="ltr"
            >
              {value}
            </span>
            {trend ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px]",
                  trend.positive
                    ? "border-ok/40 text-ok"
                    : "border-error/40 text-error",
                )}
              >
                {trend.label}
              </Badge>
            ) : null}
          </div>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
