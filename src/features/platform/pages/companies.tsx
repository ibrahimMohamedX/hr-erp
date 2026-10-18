/**
 * صفحة الشركات — إدارة كاملة بنموذج "مشروع مستقل لكل شركة":
 * إضافة شركة = خط توفير كامل (إنشاء مشروع Supabase → جاهزية → مفاتيح →
 * تحقق اتصال → تفعيل) بتقدم مباشر خطوة بخطوة — لا نجاح قبل التحقق.
 */

import { z } from "zod"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { Link } from "react-router"
import { toast } from "sonner"
import { CircleArrowRight, Plus } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  useCompanies,
  usePlatformMode,
  useProvisionCompany,
} from "@/features/platform/data/queries"
import { JobProgress } from "@/features/platform/components/job-progress"
import {
  ConnectionBadge,
  PlanBadge,
  SubscriptionBadge,
} from "@/features/platform/components/status-badges"
import type {
  PlatformTenantOverview,
  ProvisionCompanyInput,
  SubscriptionPlanKey,
} from "@/types"

const PLANS: SubscriptionPlanKey[] = ["starter", "growth", "enterprise"]
const DURATIONS = [1, 3, 6, 12]

/** رسائل التحقق تُبنى باللغة الحالية — resolver inline يتبع اللغة دائمًا */
function buildSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, { message: t("validation.nameRequired") }),
    slug: z
      .string()
      .min(2)
      .regex(/^[a-z0-9-]+$/, { message: t("validation.slugInvalid") }),
    admin_email: z.email({ message: t("validation.emailInvalid") }),
    plan: z.enum(["starter", "growth", "enterprise"]),
    duration_months: z.enum(["1", "3", "6", "12"]),
  })
}

type ProvisionForm = z.infer<ReturnType<typeof buildSchema>>

function ProvisionCompanyDialog() {
  const { t } = useTranslation()
  const provision = useProvisionCompany()
  const mode = usePlatformMode()

  const [open, setOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)

  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const form = useForm<ProvisionForm>({
    resolver,
    defaultValues: {
      name: "",
      slug: "",
      admin_email: "",
      plan: "starter",
      duration_months: "12",
    },
  })

  const onSubmit = (values: ProvisionForm) => {
    const input: ProvisionCompanyInput = {
      name: values.name,
      slug: values.slug,
      admin_email: values.admin_email,
      plan: values.plan,
      duration_months: Number(values.duration_months),
    }
    provision.mutate(input, {
      onSuccess: ({ jobId }) => {
        // المهمة بدأت — التقدم يظهر خطوة بخطوة حتى التحقق النهائي
        setJobId(jobId)
      },
      onError: (err: Error) => toast.error(err.message),
    })
  }

  const finish = (success: boolean) => {
    if (success) toast.success(t("provisioning.succeededToast"))
    else toast.error(t("provisioning.failedToast"))
    setOpen(false)
    setJobId(null)
    form.reset()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (jobId) return // لا إغلاق أثناء تنفيذ خط توفير
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("platform.companies.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {jobId
              ? t("provisioning.runningTitle")
              : t("platform.companies.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {jobId
              ? t("provisioning.runningDescription")
              : t("provisioning.dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {jobId ? (
          <>
            <JobProgress
              jobId={jobId}
              onSucceeded={() => finish(true)}
              onFailed={() => finish(false)}
            />
            <p className="text-xs text-muted-foreground">
              {mode === "demo" ? t("provisioning.demoNote") : null}
            </p>
          </>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">{t("platform.companies.name")}</Label>
              <Input
                id="company-name"
                placeholder={t("platform.companies.namePlaceholder")}
                {...form.register("name")}
              />
              {form.formState.errors.name ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.name.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-slug">{t("platform.companies.slug")}</Label>
              <Input
                id="company-slug"
                dir="ltr"
                placeholder="company-slug"
                {...form.register("slug")}
              />
              {form.formState.errors.slug ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.slug.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company-email">
                {t("platform.companies.adminEmail")}
              </Label>
              <Input
                id="company-email"
                type="email"
                dir="ltr"
                placeholder="admin@company.com"
                {...form.register("admin_email")}
              />
              {form.formState.errors.admin_email ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.admin_email.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("table.plan")}</Label>
                <Select
                  value={form.watch("plan")}
                  onValueChange={(v) =>
                    form.setValue("plan", v as ProvisionForm["plan"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((plan) => (
                      <SelectItem key={plan} value={plan}>
                        {t(`subscription.plan.${plan}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("subscription.duration")}</Label>
                <Select
                  value={form.watch("duration_months")}
                  onValueChange={(v) =>
                    form.setValue("duration_months", v as ProvisionForm["duration_months"])
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATIONS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {t("subscription.months", { count: m })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={provision.isPending}>
                {provision.isPending
                  ? t("common.loading")
                  : t("provisioning.startCta")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function PlatformCompaniesPage() {
  const { t } = useTranslation()
  const { data: companies, isLoading } = useCompanies()

  const columns: Array<DataTableColumn<PlatformTenantOverview>> = [
    {
      id: "name",
      header: t("table.company"),
      searchText: (row) => `${row.name} ${row.slug}`,
      render: (row) => (
        <Link
          to={`/platform/companies/${row.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "project",
      header: t("provisioning.projectColumn"),
      render: (row) =>
        row.project ? (
          <span className="flex flex-col">
            <span className="font-mono text-label" dir="ltr">
              {row.project.ref}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground" dir="ltr">
              {row.project.region}
            </span>
          </span>
        ) : (
          <Badge variant="outline" className="border-warn/40 text-[11px] text-warn">
            {t("provisioning.noProject")}
          </Badge>
        ),
    },
    {
      id: "plan",
      header: t("table.plan"),
      render: (row) =>
        row.subscription ? <PlanBadge plan={row.subscription.plan} /> : "—",
    },
    {
      id: "subStatus",
      header: t("table.subscription"),
      filterValue: (row) => row.subscription?.status ?? "none",
      render: (row) =>
        row.subscription ? (
          <SubscriptionBadge status={row.subscription.status} />
        ) : (
          "—"
        ),
    },
    {
      id: "connection",
      header: t("table.connection"),
      filterValue: (row) => row.connection_state,
      render: (row) => <ConnectionBadge state={row.connection_state} />,
    },
    {
      id: "employees",
      header: t("table.employees"),
      className: "hidden font-latin text-label md:table-cell",
      render: (row) => row.usage?.employee_count ?? 0,
    },
    {
      id: "open",
      header: "",
      className: "w-10",
      render: (row) => (
        <Link
          to={`/platform/companies/${row.id}`}
          aria-label={t("common.actions")}
        >
          <CircleArrowRight className="size-4 text-muted-foreground rtl:rotate-180" />
        </Link>
      ),
    },
  ]

  const filterOptions = (companies ?? []).reduce<
    Array<{ value: string; label: string }>
  >((acc, company) => {
    const status = company.subscription?.status
    if (!status) return acc
    if (!acc.some((opt) => opt.value === status)) {
      acc.push({ value: status, label: t(`subscription.status.${status}`) })
    }
    return acc
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.platform.companies")}
        description={t("platform.companies.description")}
      />

      <DemoBanner />

      <DataTable
        columns={columns}
        rows={companies ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("platform.companies.searchPlaceholder")}
        filter={{ column: columns[3], options: filterOptions }}
        toolbarActions={<ProvisionCompanyDialog />}
      />
    </div>
  )
}
