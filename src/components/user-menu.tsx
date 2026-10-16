/**
 * UserMenu — قائمة المستخدم في رأس الصفحات: صورة رمزية بالأحرف الأولى،
 * الاسم والبريد والدور، وتسجيل الخروج.
 */

import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { LogOut } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useSession } from "@/features/auth/session"

const roleKey = (role: string) => `roles.${role}`

export function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { session, isDemo, signOut } = useSession()

  if (!session) return null

  const initials = session.profile.full_name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")

  const handleSignOut = () => {
    signOut()
    navigate("/auth/login")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none ring-ring/40 focus-visible:ring-2">
        <Avatar className="size-8 border">
          <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="text-sm font-medium">{session.profile.full_name}</p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {session.user.email}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[11px]">
              {t(roleKey(session.profile.role))}
            </Badge>
            {isDemo ? (
              <Badge
                variant="outline"
                className="border-warn/40 text-[11px] text-warn"
              >
                {t("demo.badge")}
              </Badge>
            ) : null}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={handleSignOut}
          className="text-destructive"
        >
          <LogOut />
          {t("auth.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
