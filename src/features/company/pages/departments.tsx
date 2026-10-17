/**
 * قسم الهيكل التنظيمي — الإدارات: بطاقات مع عدد الموظفين + إضافة إدارة.
 */

import { z } from "zod"
import { useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Network, Plus, UserRound } from "lucide-react"

import { DemoBanner } from "@/components/demo-banner"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
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
import { Skeleton } from "@/components/ui/skeleton"
import {
  useCreateDepartment,
  useDepartments,
  useEmployees,
} from "@/features/company/data/queries"
import { useCan } from "@/features/auth/hooks/use-can"
import { permission } from "@/lib/rbac/permissions"
import type { CreateDepartmentInput } from "@/types"

/** رسائل التحقق تُبنى باللغة الحالية — resolver inline يتبع اللغة دائمًا */
function buildSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(2, { message: t("validation.nameRequired") }),
    code: z
      .string()
      .min(2)
      .max(6)
      .regex(/^[A-Za-z]+$/, { message: t("validation.codeInvalid") }),
    manager_name: z.string().optional(),
  })
}

type AddDepartmentForm = z.infer<ReturnType<typeof buildSchema>>

function AddDepartmentDialog() {
  const { t } = useTranslation()
  const createDepartment = useCreateDepartment()

  const resolver = useMemo(() => zodResolver(buildSchema(t)), [t])

  const form = useForm<AddDepartmentForm>({
    resolver,
    defaultValues: { name: "", code: "", manager_name: "" },
  })

  const onSubmit = (values: AddDepartmentForm) => {
    const input: CreateDepartmentInput = {
      name: values.name,
      code: values.code,
      manager_name: values.manager_name || null,
    }
    createDepartment.mutate(input, {
      onSuccess: (department) => {
        toast.success(t("departments.createdToast"), {
          description: `${department.name} (${department.code}) — ${t("demo.toastSuffix")}`,
        })
        form.reset()
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {t("departments.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {t("departments.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("departments.addDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dep-name">{t("departments.name")}</Label>
            <Input
              id="dep-name"
              placeholder={t("departments.namePlaceholder")}
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dep-code">{t("departments.code")}</Label>
              <Input
                id="dep-code"
                dir="ltr"
                placeholder="ENG"
                {...form.register("code")}
              />
              {form.formState.errors.code ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.code.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dep-manager">{t("departments.manager")}</Label>
              <Input
                id="dep-manager"
                placeholder={t("departments.managerPlaceholder")}
                {...form.register("manager_name")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createDepartment.isPending}>
              {createDepartment.isPending
                ? t("common.loading")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DepartmentsPage() {
  const { t } = useTranslation()
  const { data: departments, isLoading } = useDepartments()
  const { data: employees } = useEmployees()
  const canCreate = useCan(permission("module:departments", "create"))

  const headcount = (depId: string) =>
    employees?.filter((e) => e.department_id === depId).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.departments.name")}
        description={t("modules.departments.description")}
        actions={canCreate.allowed ? <AddDepartmentDialog /> : null}
      />

      <DemoBanner />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments?.map((dep) => (
            <Card key={dep.id} className="transition-colors hover:border-arc/35">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Network className="size-4.5" />
                    </span>
                    {dep.name}
                  </span>
                  <Badge variant="secondary" className="font-latin text-label">
                    {dep.code}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <UserRound className="size-4" />
                  {dep.manager_name ?? t("departments.noManager")}
                </p>
                <p className="font-latin text-label" dir="ltr">
                  {headcount(dep.id)} {t("departments.employeesSuffix")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
