/**
 * ModuleIcon — يحول اسم الأيقونة (نص) في سجل الأقسام إلى مكون Lucide فعلي.
 */

import {
  Banknote,
  BarChart3,
  CalendarClock,
  Network,
  Palmtree,
  ShieldCheck,
  Target,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  Users,
  CalendarClock,
  Palmtree,
  Banknote,
  UserPlus,
  Network,
  Target,
  BarChart3,
  ShieldCheck,
}

export function ModuleIcon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = ICONS[name] ?? BarChart3
  return <Icon className={className} />
}
