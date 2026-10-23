/**
 * LeaveTypesManager — حوارية إدارة أنواع الإجازات وقواعد استحقاقها:
 * جدول الأنواع (الاسم · الوصف · الاستحقاق السنوي · مدفوعة · نشط ·
 * عدد الطلبات) + إضافة/تعديل نموذج داخلي + حذف مقيّد.
 *
 * الاستحقاق السنوي حقل اختياري — الفارغ يعني نوعًا بلا حد (رصيد
 * غير محدود). الحذف مرفوض من طبقة البيانات للنوع الذي له طلبات
 * ("Leave type has requests" — مطابق restrict في قاعدة البيانات).
 */

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Pencil, Plus, Trash2 } from "lucide-react"

import {
  DataTable,
  type DataTableColumn,
} from "@/components/data-table"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateLeaveType,
  useDeleteLeaveType,
  useLeaveRequests,
  useLeaveTypes,
  useUpdateLeaveType,
} from "@/features/company/data/queries"
import { appEnv } from "@/config/env"
import type {
  CreateLeaveTypeInput,
  LeaveTypeDefinition,
} from "@/types"
import { mapLeaveError } from "./leave-request-form"

/** نموذج داخلي: annual_days نصي — الفارغ يعني null (بلا حد) */
interface TypeFormValues {
  name: string
  description: string
  annualDaysText: string
  is_paid: boolean
  is_active: boolean
}

function LeaveTypeForm({
  editing,
  onDone,
}: {
  /** null = إنشاء جديد */
  editing: LeaveTypeDefinition | null
  onDone: () => void
}) {
  const { t } = useTranslation()
  const isDemo = appEnv.companyMode === "demo"

  const createType = useCreateLeaveType()
  const updateType = useUpdateLeaveType()

  const [values, setValues] = useState<TypeFormValues>(() =>
    editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          annualDaysText:
            editing.annual_days === null ? "" : String(editing.annual_days),
          is_paid: editing.is_paid,
          is_active: editing.is_active,
        }
      : { name: "", description: "", annualDaysText: "", is_paid: true, is_active: true },
  )
  const [error, setError] = useState<string | null>(null)

  const isPending = createType.isPending || updateType.isPending

  const submit = () => {
    const name = values.name.trim()
    if (!name) {
      setError(t("validation.typeNameRequired"))
      return
    }
    const days = values.annualDaysText.trim()
    const parsedDays =
      days === "" ? null : Number.parseInt(days, 10)
    if (parsedDays !== null && (!Number.isFinite(parsedDays) || parsedDays < 0)) {
      setError(t("validation.annualDaysInvalid"))
      return
    }
    const input: CreateLeaveTypeInput = {
      name,
      description: values.description.trim() ? values.description.trim() : null,
      annual_days: parsedDays,
      is_paid: values.is_paid,
      is_active: values.is_active,
    }
    const description = name + (parsedDays !== null ? ` · ${parsedDays}` : " · ∞")

    if (editing) {
      updateType.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success(t("leaves.types.updatedToast"), {
              description: `${description}${isDemo ? ` · ${t("demo.toastSuffix")}` : ""}`,
            })
            onDone()
          },
          onError: (err) => toast.error(mapLeaveError(t, err)),
        },
      )
      return
    }
    createType.mutate(input, {
      onSuccess: () => {
        toast.success(t("leaves.types.createdToast"), {
          description: `${description}${isDemo ? ` · ${t("demo.toastSuffix")}` : ""}`,
        })
        onDone()
      },
      onError: (err) => toast.error(mapLeaveError(t, err)),
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lv-type-name">{t("leaves.types.name")}</Label>
        <Input
          id="lv-type-name"
          data-testid="lv-type-name"
          value={values.name}
          onChange={(e) => {
            setValues((v) => ({ ...v, name: e.target.value }))
            setError(null)
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="lv-type-description">{t("leaves.types.description")}</Label>
        <Textarea
          id="lv-type-description"
          rows={2}
          data-testid="lv-type-description"
          value={values.description}
          onChange={(e) =>
            setValues((v) => ({ ...v, description: e.target.value }))
          }
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="lv-type-days">{t("leaves.types.annualDays")}</Label>
          <Input
            id="lv-type-days"
            type="number"
            min={0}
            dir="ltr"
            placeholder="∞"
            data-testid="lv-type-days"
            value={values.annualDaysText}
            onChange={(e) =>
              setValues((v) => ({ ...v, annualDaysText: e.target.value }))
            }
          />
          <p className="text-xs text-muted-foreground">
            {t("leaves.types.annualDaysHint")}
          </p>
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <Switch
            id="lv-type-paid"
            data-testid="lv-type-paid"
            checked={values.is_paid}
            onCheckedChange={(checked) =>
              setValues((v) => ({ ...v, is_paid: checked }))
            }
          />
          <Label htmlFor="lv-type-paid">{t("leaves.types.paid")}</Label>
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <Switch
            id="lv-type-active"
            data-testid="lv-type-active"
            checked={values.is_active}
            onCheckedChange={(checked) =>
              setValues((v) => ({ ...v, is_active: checked }))
            }
          />
          <Label htmlFor="lv-type-active">{t("leaves.types.active")}</Label>
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={isPending}
          data-testid="lv-type-submit"
          onClick={submit}
        >
          {isPending
            ? t("common.loading")
            : editing
              ? t("common.save")
              : t("leaves.types.add")}
        </Button>
      </div>
    </div>
  )
}

export interface LeaveTypesManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeaveTypesManager({ open, onOpenChange }: LeaveTypesManagerProps) {
  const { t } = useTranslation()
  const { data: types, isLoading } = useLeaveTypes()
  const { data: requests } = useLeaveRequests()
  const deleteType = useDeleteLeaveType()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LeaveTypeDefinition | null>(null)
  const [deleting, setDeleting] = useState<LeaveTypeDefinition | null>(null)

  const requestsCount = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of requests ?? []) {
      map.set(r.leave_type_id, (map.get(r.leave_type_id) ?? 0) + 1)
    }
    return map
  }, [requests])

  const columns: Array<DataTableColumn<LeaveTypeDefinition>> = [
    {
      id: "name",
      header: t("leaves.types.name"),
      searchText: (row) => row.name,
      sortValue: (row) => row.name,
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "description",
      header: t("leaves.types.description"),
      className: "hidden max-w-48 truncate text-muted-foreground md:table-cell",
      render: (row) => row.description ?? "—",
    },
    {
      id: "annualDays",
      header: t("leaves.types.annualDays"),
      className: "font-latin text-label",
      sortValue: (row) => row.annual_days ?? Number.MAX_SAFE_INTEGER,
      render: (row) => (
        <span dir="ltr">{row.annual_days === null ? "∞" : row.annual_days}</span>
      ),
    },
    {
      id: "isPaid",
      header: t("leaves.types.paid"),
      sortValue: (row) => (row.is_paid ? "1" : "0"),
      render: (row) => (
        <Badge variant="outline" className={row.is_paid ? "border-ok/40 text-ok" : "border-error/40 text-error"}>
          {row.is_paid ? t("leaves.types.paid") : t("leaves.types.unpaid")}
        </Badge>
      ),
    },
    {
      id: "isActive",
      header: t("leaves.types.active"),
      sortValue: (row) => (row.is_active ? "1" : "0"),
      render: (row) => (
        <Badge
          variant="outline"
          className={row.is_active ? "border-ok/40 text-ok" : "border-muted-foreground/40 text-muted-foreground"}
        >
          {row.is_active ? t("leaves.types.activeLabel") : t("leaves.types.inactiveLabel")}
        </Badge>
      ),
    },
    {
      id: "requests",
      header: t("leaves.types.requestsCount"),
      className: "font-latin text-label",
      sortValue: (row) => requestsCount.get(row.id) ?? 0,
      render: (row) => <span dir="ltr">{requestsCount.get(row.id) ?? 0}</span>,
    },
    {
      id: "actions",
      header: t("common.actions"),
      className: "w-24",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("common.edit")}
            title={t("common.edit")}
            data-testid={`lv-row-edit-${row.id}`}
            onClick={() => {
              setEditing(row)
              setFormOpen(true)
            }}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={t("common.delete")}
            title={t("common.delete")}
            data-testid={`lv-row-delete-${row.id}`}
            onClick={() => setDeleting(row)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("leaves.types.title")}
            </DialogTitle>
            <DialogDescription>
              {t("leaves.types.description2")}
            </DialogDescription>
          </DialogHeader>

          <div data-testid="lv-types-table">
            <DataTable
              columns={columns}
              rows={types ?? []}
              isLoading={isLoading}
              searchPlaceholder={t("common.search")}
              pageSize={50}
              emptyMessage={t("common.noData")}
              toolbarActions={
                <Button
                  data-testid="lv-type-add"
                  onClick={() => {
                    setEditing(null)
                    setFormOpen(true)
                  }}
                >
                  <Plus />
                  {t("leaves.types.add")}
                </Button>
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* نموذج إضافة/تعديل نوع — حوارية متداخلة */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? t("leaves.types.editTitle") : t("leaves.types.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("leaves.types.addDescription")}
            </DialogDescription>
          </DialogHeader>
          <LeaveTypeForm
            key={editing?.id ?? "new"}
            editing={editing}
            onDone={() => setFormOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* تأكيد حذف نوع — مقيّد بوجود طلبات */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              {t("leaves.types.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("leaves.types.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting ? (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium">
              {deleting.name}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteType.isPending}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteType.isPending}
              data-testid="lv-confirm-delete-type"
              onClick={(event) => {
                if (!deleting) return
                event.preventDefault()
                deleteType.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.success(t("leaves.types.deletedToast"), {
                      description: deleting.name,
                    })
                    setDeleting(null)
                  },
                  onError: (error) => toast.error(mapLeaveError(t, error)),
                })
              }}
            >
              {deleteType.isPending ? t("common.loading") : t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
