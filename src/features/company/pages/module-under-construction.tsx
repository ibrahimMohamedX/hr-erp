/**
 * صفحة قسم قيد الإنشاء — احترافية: هوية القسم من السجل + اعتمادياته + حالة البناء.
 * تُستخدم للأقسام غير المنفذة في هذه النسخة (Payroll · Recruitment ·
 * Performance · Reports · Permissions) — كل قسم يظهر بمعلوماته الحقيقية.
 */

import { useTranslation } from "react-i18next"
import { Construction } from "lucide-react"

import { ModuleIcon } from "@/components/module-icon"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getHrModule } from "@/config/modules"
import type { HrModuleKey, Locale } from "@/types"

export function ModuleUnderConstructionPage({
  moduleKey,
}: {
  moduleKey: HrModuleKey
}) {
  const { t, i18n } = useTranslation()
  const locale = (i18n.language?.startsWith("en") ? "en" : "ar") as Locale
  const definition = getHrModule(moduleKey)

  const dependencies = definition.dependsOn.map((dep) => getHrModule(dep))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ModuleIcon name={definition.icon} className="size-6" />
          </span>
          <div>
            <h1 className="font-display text-h3 font-semibold tracking-tight">
              {definition.name[locale]}
            </h1>
            <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
              {definition.description[locale]}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit gap-1.5 border-warn/50 text-warn">
          <Construction className="size-3.5" />
          {t("modules.underConstruction")}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("modules.constructionPlan")}
          </CardTitle>
          <CardDescription>
            {t("modules.constructionPlanDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("modules.constructionNote")}
          </p>

          {dependencies.length > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {t("modules.dependsOn")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {dependencies.map((dep) => (
                    <Badge key={dep.key} variant="secondary" className="gap-1.5">
                      <ModuleIcon name={dep.icon} className="size-3" />
                      {dep.name[locale]}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <Separator />
          <p className="font-mono text-label text-muted-foreground" dir="ltr">
            key: {definition.key} · route: {definition.route} · status:{" "}
            {definition.status}
          </p>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground/60">
        {t("modules.roadmapHint")}
        {" "}
        <span className="font-latin">docs/07-roadmap.md</span>
      </p>
    </div>
  )
}

/** توجيه مفتاح القسم للصفحة المناسبة */
export function isModuleImplemented(key: HrModuleKey): boolean {
  return ["employees", "attendance", "leaves", "departments"].includes(key)
}
