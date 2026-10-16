/**
 * شارات حالة المنصة — اتصال الشركة، حالة الاشتراك، الخطة.
 */

import { useTranslation } from "react-i18next"
import type {
  EntityStatus,
  SubscriptionPlanKey,
  SubscriptionStatus,
  TenantConnectionState,
} from "@/types"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const connectionColors: Record<TenantConnectionState, string> = {
  connected: "bg-ok",
  degraded: "bg-warn",
  disconnected: "bg-error",
}

export function ConnectionBadge({
  state,
}: {
  state: TenantConnectionState
}) {
  const { t } = useTranslation()

  return (
    <Badge variant="outline" className="gap-1.5 text-[11px]">
      <span className={cn("size-1.5 rounded-full", connectionColors[state])} />
      {t(`connection.${state}`)}
    </Badge>
  )
}

const subStatusStyles: Record<SubscriptionStatus, string> = {
  trialing: "border-arc/40 text-arc",
  active: "border-ok/40 text-ok",
  past_due: "border-warn/50 text-warn",
  suspended: "border-error/50 text-error",
  cancelled: "border-muted-foreground/30 text-muted-foreground",
  expired: "border-muted-foreground/30 text-muted-foreground",
}

export function SubscriptionBadge({
  status,
}: {
  status: SubscriptionStatus
}) {
  const { t } = useTranslation()

  return (
    <Badge
      variant="outline"
      className={cn("text-[11px]", subStatusStyles[status])}
    >
      {t(`subscription.status.${status}`)}
    </Badge>
  )
}

const planStyles: Record<SubscriptionPlanKey, string> = {
  starter: "border-muted-foreground/30",
  growth: "border-arc/40 text-arc",
  enterprise: "border-copper/50 text-copper",
  custom: "border-copper/50 text-copper",
}

export function PlanBadge({ plan }: { plan: SubscriptionPlanKey }) {
  const { t } = useTranslation()

  return (
    <Badge
      variant="outline"
      className={cn("font-latin text-[11px]", planStyles[plan])}
    >
      {t(`subscription.plan.${plan}`)}
    </Badge>
  )
}

export function TenantStatusBadge({ status }: { status: EntityStatus }) {
  const { t } = useTranslation()

  return (
    <Badge
      variant={status === "active" ? "secondary" : "outline"}
      className="text-[11px]"
    >
      {t(`entityStatus.${status}`)}
    </Badge>
  )
}
