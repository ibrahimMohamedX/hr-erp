/**
 * PagePlaceholder — صفحة هيكلية موحدة للمناطق غير المنفذة بعد.
 * تُستخدم في كل مسارات هذه المرحلة: عناوين ووصف حقيقي + وسم "مرحلة لاحقة".
 * ليست صفحة تصميمية — مجرد علامة بنائية واضحة في شجرة الروابط.
 */

import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface PagePlaceholderProps {
  /** مفتاح ترجمة العنوان — مثل "nav.platform.companies" */
  titleKey: string
  /** مفتاح ترجمة الوصف */
  descriptionKey?: string
  /** محتوى إضافي اختياري داخل الصفحة */
  children?: ReactNode
}

export function PagePlaceholder({
  titleKey,
  descriptionKey,
  children,
}: PagePlaceholderProps) {
  const { t } = useTranslation()

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="font-display">{t(titleKey)}</CardTitle>
            <Badge variant="outline" className="font-latin text-label">
              {t("placeholders.phaseTag")}
            </Badge>
          </div>
          {descriptionKey ? (
            <CardDescription>{t(descriptionKey)}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="text-body text-muted-foreground">
          <p>{t("placeholders.futurePhase")}</p>
          {children}
        </CardContent>
      </Card>
    </div>
  )
}
