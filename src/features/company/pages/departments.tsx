/**
 * قسم الهيكل التنظيمي — صفحتان داخلية:
 *  1) الأقسام: بطاقات مع عدد الموظفين + إضافة/تعديل/حذف (RBAC).
 *  2) المناصب الوظيفية: كتالوج معتمد (جدول + إضافة/تعديل/حذف).
 *
 * الحذف له قواعد مشددة: قسم به موظفون لا يُحذف (يُرفض برسالة واضحة)،
 * وحذف منصب يفقد الموظفين المرتبطين الربط فقط — بياناتهم تبقى سليمة.
 */

import { z } from "zod"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Network, Pencil, Plus, Trash2, UserRound } from "lucide-react"

import { DataTable, type DataTableColumn } from "@/components/data-table"
import { DemoBanner } from "@/components/demo-banner"
import { PageHeader } from "@/components/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Skeleton } from "@/components/ui/skeleton"
import { useCan } from "@/features/auth/hooks/use-can"
import {
  useCreateDepartment,
  useCreatePosition,
  useDeleteDepartment,
  useDeletePosition,
  useDepartments,
  useEmployees,
  usePositions,
  useUpdateDepartment,
  useUpdatePosition,
} from "@/features/company/data/queries"
import { appEnv } from "@/config/env"
import { permission } from "@/lib/rbac/permissions"
import type {
  CreateDepartmentInput,
  CreatePositionInput,
  Department,
  Position,
} from "@/types"

/** قيمة حارسة للـ Select — Radix يرفض القيمة الفارغة "" */
const NO_DEPARTMENT = "__none__"

/** وصف الـ toast: يُسبق باسم الكيان، ولاحقة الوضع التجريبي في demo فقط */
function toastDescription(
  main: string,
  isDemo: boolean,
  t: (key: string) => string,
): string {
  return isDemo ? `${main} — ${t("demo.toastSuffix")}` : main
}

// ─── نماذج التحقق — تُبنى باللغة الحالية (resolver يتبع اللغة دائمًا) ────────

function buildDepartmentSchema(t: (key: string) => string) {
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

type DepartmentForm = z.infer<ReturnType<typeof buildDepartmentSchema>>

function buildPositionSchema(t: (key: string) => string) {
  return z.object({
    code: z.string().regex(/^[A-Za-z0-9]{2,8}$/, {
      message: t("validation.positionCodeInvalid"),
    }),
    title: z.string().min(2, { message: t("validation.titleRequired") }),
    department_id: z.string(),
  })
}

type PositionForm = z.infer<ReturnType<typeof buildPositionSchema>>

// ─── حوار القسم: إنشاء/تعديل بنفس النموذج ───────────────────────────────────

function DepartmentDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = إنشاء قسم جديد */
  department: Department | null
}) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"
  const isEdit = department !== null
  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment()
  const isPending = createDepartment.isPending || updateDepartment.isPending

  const resolver = useMemo(() => zodResolver(buildDepartmentSchema(t)), [t])
  const form = useForm<DepartmentForm>({
    resolver,
    defaultValues: { name: "", code: "", manager_name: "" },
  })

  // تعبئة النموذج عند كل فتح: بيانات القسم في التعديل، أو فراغ في الإنشاء
  useEffect(() => {
    if (open) {
      form.reset(
        isEdit
          ? {
              name: department.name,
              code: department.code,
              manager_name: department.manager_name ?? "",
            }
          : { name: "", code: "", manager_name: "" },
      )
    }
  }, [open, isEdit, department, form])

  const onSubmit = (values: DepartmentForm) => {
    const input: CreateDepartmentInput = {
      name: values.name,
      code: values.code.toUpperCase(),
      manager_name: values.manager_name || null,
    }

    if (isEdit) {
      updateDepartment.mutate(
        { id: department.id, input },
        {
          onSuccess: (updated) => {
            toast.success(t("departments.editToast"), {
              description: toastDescription(
                `${updated.name} (${updated.code})`,
                isDemo,
                t,
              ),
            })
            onOpenChange(false)
          },
          onError: () => toast.error(t("common.error")),
        },
      )
      return
    }

    createDepartment.mutate(input, {
      onSuccess: (created) => {
        toast.success(t("departments.createdToast"), {
          description: toastDescription(
            `${created.name} (${created.code})`,
            isDemo,
            t,
          ),
        })
        onOpenChange(false)
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit
              ? t("departments.editTitle")
              : t("departments.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("departments.editDescription")
              : t("departments.addDescription")}
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
            <Button
              type="submit"
              disabled={isPending}
            >
              {isPending
                ? t("common.loading")
                : isEdit
                  ? t("common.save")
                  : t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── حوار المنصب: إنشاء/تعديل بنفس النموذج ──────────────────────────────────

function PositionDialog({
  open,
  onOpenChange,
  position,
  departments,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null = إنشاء منصب جديد */
  position: Position | null
  departments: Department[]
}) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"
  const isEdit = position !== null
  const createPosition = useCreatePosition()
  const updatePosition = useUpdatePosition()
  const isPending = createPosition.isPending || updatePosition.isPending

  const resolver = useMemo(() => zodResolver(buildPositionSchema(t)), [t])
  const form = useForm<PositionForm>({
    resolver,
    defaultValues: { code: "", title: "", department_id: NO_DEPARTMENT },
  })

  // تعبئة النموذج عند كل فتح: بيانات المنصب في التعديل، أو فراغ في الإنشاء
  useEffect(() => {
    if (open) {
      form.reset(
        isEdit
          ? {
              code: position.code,
              title: position.title,
              department_id: position.department_id ?? NO_DEPARTMENT,
            }
          : { code: "", title: "", department_id: NO_DEPARTMENT },
      )
    }
  }, [open, isEdit, position, form])

  const onSubmit = (values: PositionForm) => {
    const input: CreatePositionInput = {
      code: values.code.toUpperCase(),
      title: values.title,
      department_id:
        values.department_id === NO_DEPARTMENT
          ? null
          : values.department_id,
    }

    if (isEdit) {
      updatePosition.mutate(
        { id: position.id, input },
        {
          onSuccess: (updated) => {
            toast.success(t("positions.editToast"), {
              description: toastDescription(
                `${updated.title} (${updated.code})`,
                isDemo,
                t,
              ),
            })
            onOpenChange(false)
          },
          onError: () => toast.error(t("common.error")),
        },
      )
      return
    }

    createPosition.mutate(input, {
      onSuccess: (created) => {
        toast.success(t("positions.createdToast"), {
          description: toastDescription(
            `${created.title} (${created.code})`,
            isDemo,
            t,
          ),
        })
        onOpenChange(false)
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? t("positions.editTitle") : t("positions.addTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? t("positions.editDescription")
              : t("positions.addDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pos-code">{t("positions.code")}</Label>
              <Input
                id="pos-code"
                dir="ltr"
                placeholder={t("positions.codePlaceholder")}
                {...form.register("code")}
              />
              {form.formState.errors.code ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.code.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos-title">{t("positions.title")}</Label>
              <Input
                id="pos-title"
                placeholder={t("positions.titlePlaceholder")}
                {...form.register("title")}
              />
              {form.formState.errors.title ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("positions.department")}</Label>
            <Select
              value={form.watch("department_id")}
              onValueChange={(v) => form.setValue("department_id", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEPARTMENT}>
                  {t("positions.departmentNone")}
                </SelectItem>
                {departments.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {dep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("common.loading")
                : isEdit
                  ? t("common.save")
                  : t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── حوار تأكيد حذف قسم ─────────────────────────────────────────────────────

function DeleteDepartmentDialog({
  department,
  onClose,
}: {
  /** null = الحوار مغلق */
  department: Department | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const deleteDepartment = useDeleteDepartment()

  const confirm = (event: React.MouseEvent) => {
    if (!department) return
    // نمنع الإغلاق التلقائي — الحوار يُغلق بعد النتيجة الفعلية فقط
    event.preventDefault()
    deleteDepartment.mutate(department.id, {
      onSuccess: () => {
        toast.success(t("departments.deleteToast"))
        onClose()
      },
      onError: (error) => {
        const message = error instanceof Error ? error.message : ""
        toast.error(
          message.includes("Department has employees")
            ? t("departments.deleteBlocked")
            : t("common.error"),
        )
      },
    })
  }

  return (
    <AlertDialog open={department !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            {t("departments.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("departments.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {department ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
            {department.name} ·{" "}
            <span className="font-latin text-label" dir="ltr">
              {department.code}
            </span>
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteDepartment.isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleteDepartment.isPending}
            onClick={confirm}
          >
            {deleteDepartment.isPending
              ? t("common.loading")
              : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── حوار تأكيد حذف منصب ────────────────────────────────────────────────────

function DeletePositionDialog({
  position,
  onClose,
}: {
  /** null = الحوار مغلق */
  position: Position | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const deletePosition = useDeletePosition()

  const confirm = (event: React.MouseEvent) => {
    if (!position) return
    event.preventDefault()
    deletePosition.mutate(position.id, {
      onSuccess: () => {
        toast.success(t("positions.deleteToast"))
        onClose()
      },
      onError: () => toast.error(t("common.error")),
    })
  }

  return (
    <AlertDialog open={position !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            {t("positions.deleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("positions.deleteDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {position ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
            {position.title} ·{" "}
            <span className="font-latin text-label" dir="ltr">
              {position.code}
            </span>
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePosition.isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deletePosition.isPending}
            onClick={confirm}
          >
            {deletePosition.isPending
              ? t("common.loading")
              : t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ─── الصفحة ──────────────────────────────────────────────────────────────────

export function DepartmentsPage() {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"
  const { data: departments, isLoading } = useDepartments()
  const { data: employees } = useEmployees()
  const positionsQuery = usePositions()

  const canCreate = useCan(permission("module:departments", "create")).allowed
  const canEdit = useCan(permission("module:departments", "update")).allowed
  const canDelete = useCan(permission("module:departments", "delete")).allowed

  // حوارات مركزية — واحدة لكل غرض، تُفتح بحسب الحالة
  const [departmentDialog, setDepartmentDialog] = useState<{
    open: boolean
    department: Department | null
  }>({ open: false, department: null })
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(
    null,
  )
  const [positionDialog, setPositionDialog] = useState<{
    open: boolean
    position: Position | null
  }>({ open: false, position: null })
  const [deletingPosition, setDeletingPosition] = useState<Position | null>(null)

  const depName = useMemo(() => {
    const map = new Map<string, string>()
    departments?.forEach((d) => map.set(d.id, d.name))
    return map
  }, [departments])

  const headcount = (depId: string) =>
    employees?.filter((e) => e.department_id === depId).length ?? 0

  const linkedCount = (positionId: string) =>
    employees?.filter((e) => e.position_id === positionId).length ?? 0

  const positionColumns: Array<DataTableColumn<Position>> = [
    {
      id: "code",
      header: t("positions.code"),
      className: "font-mono text-label",
      searchText: (pos) => pos.code,
      render: (pos) => <span dir="ltr">{pos.code}</span>,
    },
    {
      id: "title",
      header: t("positions.title"),
      searchText: (pos) => pos.title,
      render: (pos) => pos.title,
    },
    {
      id: "department",
      header: t("positions.department"),
      searchText: (pos) =>
        pos.department_id ? (depName.get(pos.department_id) ?? "") : "",
      render: (pos) =>
        pos.department_id
          ? (depName.get(pos.department_id) ?? "—")
          : t("positions.departmentNone"),
    },
    {
      id: "count",
      header: t("table.employees"),
      className: "font-latin text-label",
      render: (pos) => (
        <span dir="ltr">
          {linkedCount(pos.id)} {t("positions.employeesSuffix")}
        </span>
      ),
    },
  ]

  // عمود الإجراءات يُضاف فقط عند توفر صلاحية واحدة على الأقل
  if (canEdit || canDelete) {
    positionColumns.push({
      id: "actions",
      header: t("common.actions"),
      className: "w-24",
      render: (pos) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("common.edit")}
              onClick={() =>
                setPositionDialog({ open: true, position: pos })
              }
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("common.delete")}
              onClick={() => setDeletingPosition(pos)}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      ),
    })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("modules.departments.name")}
        description={t("modules.departments.description")}
        actions={
          canCreate ? (
            <Button
              onClick={() =>
                setDepartmentDialog({ open: true, department: null })
              }
            >
              <Plus />
              {t("departments.add")}
            </Button>
          ) : null
        }
      />

      {isDemo ? <DemoBanner /> : null}

      {/* ── 1) الأقسام ───────────────────────────────────────────────── */}
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
                {canEdit || canDelete ? (
                  <div className="flex items-center justify-end gap-1 pt-1">
                    {canEdit ? (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={t("common.edit")}
                        onClick={() =>
                          setDepartmentDialog({ open: true, department: dep })
                        }
                      >
                        <Pencil className="size-4" />
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label={t("common.delete")}
                        onClick={() => setDeletingDepartment(dep)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── 2) المناصب الوظيفية ──────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {t("departments.positionsLabel")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("departments.positionsDescription")}
            </p>
          </div>
          {canCreate ? (
            <Button
              onClick={() => setPositionDialog({ open: true, position: null })}
            >
              <Plus />
              {t("positions.add")}
            </Button>
          ) : null}
        </div>

        <DataTable
          columns={positionColumns}
          rows={positionsQuery.data ?? []}
          isLoading={positionsQuery.isLoading}
          pageSize={6}
        />
      </section>

      {/* ── الحوارات المركزية ───────────────────────────────────────── */}
      <DepartmentDialog
        open={departmentDialog.open}
        onOpenChange={(open) =>
          setDepartmentDialog((prev) => ({ ...prev, open }))
        }
        department={departmentDialog.department}
      />

      <DeleteDepartmentDialog
        department={deletingDepartment}
        onClose={() => setDeletingDepartment(null)}
      />

      <PositionDialog
        open={positionDialog.open}
        onOpenChange={(open) => setPositionDialog((prev) => ({ ...prev, open }))}
        position={positionDialog.position}
        departments={departments ?? []}
      />

      <DeletePositionDialog
        position={deletingPosition}
        onClose={() => setDeletingPosition(null)}
      />
    </div>
  )
}
