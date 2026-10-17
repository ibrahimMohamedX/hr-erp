/**
 * صفحة تسجيل الدخول — نسخة فعلية مصقولة.
 *
 * وضعان:
 * 1) نموذج البريد/كلمة المرور: يعمل عبر Supabase Auth عند توفر الإعداد
 *    (ربط البروفايل الكامل يتطلب migrations — docs/05-supabase.md).
 * 2) الوضع التجريبي: دخول فوري بأحد الأدوار الثلاثة — بيانات تجريبية موسومة.
 */

import { z } from "zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "react-router"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Building2,
  CircleArrowRight,
  Info,
  LogIn,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { AppToggles } from "@/components/app-toggles"
import { ArchaiMark } from "@/components/archai-mark"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  homeRouteForRole,
  useSession,
} from "@/features/auth/session"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { getSupabaseClientOrNull } from "@/lib/supabase/client"
import { useDocumentTitle } from "@/hooks/use-document-title"
import type { AppRole } from "@/types"

const DEMO_ROLES: Array<{
  role: AppRole
  icon: typeof ShieldCheck
  titleKey: string
  descKey: string
}> = [
  {
    role: "platform_super_admin",
    icon: ShieldCheck,
    titleKey: "login.demoPlatform",
    descKey: "login.demoPlatformDesc",
  },
  {
    role: "company_admin",
    icon: Building2,
    titleKey: "login.demoCompanyAdmin",
    descKey: "login.demoCompanyAdminDesc",
  },
  {
    role: "company_user",
    icon: UserRound,
    titleKey: "login.demoCompanyUser",
    descKey: "login.demoCompanyUserDesc",
  },
]

type LoginForm = z.infer<ReturnType<typeof buildSchema>>

function buildSchema(t: (key: string) => string) {
  return z.object({
    email: z.email({ message: t("validation.emailInvalid") }),
    password: z.string().min(8, { message: t("validation.passwordMin") }),
  })
}

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { signInDemo } = useSession()
  const supabaseReady = isSupabaseConfigured()

  useDocumentTitle(t("auth.loginTitle"))

  // resolver مُنشأ في مكانه: رسائل التحقق تتبع اللغة الحالية دائمًا
  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const form = useForm<LoginForm>({
    resolver,
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = async (values: LoginForm) => {
    const client = getSupabaseClientOrNull()
    if (!client) {
      toast.info(t("login.demoOnlyHint"))
      return
    }
    const { error } = await client.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    // تم التحقق من الهوية عبر Supabase — بناء الجلسة الكاملة يتطلب جدول
    // profiles (migrations في مرحلة قاعدة البيانات — docs/07-roadmap.md)
    toast.info(t("login.supabaseProfilePending"))
  }

  const enterDemo = (role: AppRole) => {
    signInDemo(role)
    toast.success(t("login.demoWelcome"))
    navigate(homeRouteForRole(role))
  }

  return (
    <main className="relative grid min-h-dvh place-items-center p-4">
      <div className="absolute end-4 top-4">
        <AppToggles />
      </div>

      <div className="w-full max-w-md animate-in-up">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex flex-col items-center gap-2">
              <ArchaiMark size="lg" className="glow-soft" />
              <span className="font-latin text-sm font-semibold tracking-wide">
                Archai <span className="text-primary">HR</span>
              </span>
            </div>
            <CardTitle className="font-display">
              {t("login.title")}
            </CardTitle>
            <CardDescription>{t("app.tagline")}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t("login.email")}</Label>
                <Input
                  id="login-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  placeholder="name@company.com"
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">{t("login.password")}</Label>
                <Input
                  id="login-password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                <LogIn className="size-4" />
                {t("login.submit")}
              </Button>
            </form>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="font-mono text-label text-muted-foreground">
                {t("login.demoTitle")}
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-2">
              {DEMO_ROLES.map(({ role, icon: Icon, titleKey, descKey }) => (
                <Button
                  key={role}
                  variant="outline"
                  className="h-auto w-full justify-start gap-3 py-3 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                  onClick={() => enterDemo(role)}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent">
                    <Icon className="size-4.5 text-primary" />
                  </span>
                  <span className="flex flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{t(titleKey)}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(descKey)}
                    </span>
                  </span>
                  <CircleArrowRight className="ms-auto size-4 text-muted-foreground rtl:rotate-180" />
                </Button>
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-warn/30 bg-warn/10 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-warn" />
              <p>
                {supabaseReady
                  ? t("login.supabaseConfiguredNote")
                  : t("login.demoNotice")}
              </p>
            </div>

            <p className="text-center font-mono text-label text-muted-foreground">
              <Badge variant="secondary" className="me-2">
                {t("demo.badge")}
              </Badge>
              archai/hr-erp · v0.2
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
