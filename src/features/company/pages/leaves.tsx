/**
 * قسم الإجازات — الطلبات حسب الحالة + تقديم طلب جديد عبر نموذج مُتحقق.
 * مسارات الموافقة متعددة المستويات والخصم من الأرصدة مراحل لاحقة.
 */

import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Plus } from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateLeaveRequest,
  useEmployees,
  useLeaveRequests,
} from "@/features/company/data/queries"
import { useCan } from "@/features/auth/hooks/use-can"
import { permission } from "@/lib/rbac/permissions"
import { cn } from "@/lib/utils"
import type {
  CreateLeaveRequestInput,
  LeaveRequest,
  LeaveRequestStatus,
  LeaveType,
} from "@/types"

const leaveStatusStyles: Record<LeaveRequestStatus, string> = {
  pending: "border-warn/50 text-warn",
  approved: "border-ok/40 text-ok",
  rejected: "border-error/50 text-error",
}

const leaveTypeKeys: Record<LeaveType, string> = {
  annual: "leaves.type.annual",
  sick: "leaves.type.sick",
  casual: "leaves.type.casual",
  unpaid: "leaves.type.unpaid",
}

function StatusBadge({ status }: { status: LeaveRequestStatus }) {
  const { t } = useTranslation()
  return (
    <Badge
      variant="outline"
      className={cn("text-[11px]", leaveStatusStyles[status])}
    >
      {t(`leaves.status.${status}`)}
    </Badge>
  )
}

const newLeaveSchema = z
  .object({
    employee_id: z.string().min(1, { message: "اختر الموظف" }),
    type: z.enum(["annual", "sick", "casual", "unpaid"]),
    start_date: z.string().min(1, { message: "تاريخ البداية مطلوب" }),
    end_date: z.string().min(1, { message: "تاريخ النهاية مطلوب" }),
    reason: z.string().optional(),
  })
  .refine(
    (values) => {
      const start = new Date(values.start_date).getTime()
      const end = new Date(values.end_date).getTime()
      return !Number.isNaN(start) && !Number.isNaN(end) && end >= start
    },
    { message: "تاريخ النهاية قبل البداية", path: ["end_date"] },
  )

type NewLeaveForm = z.infer<typeof newLeaveSchema>

const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "casual", "unpaid"]

function NewLeaveDialog({ employees }: { employees: { id: string; name: string }[] }) {
  const { t } = useTranslation()
  const createLeave = useCreateLeaveRequest()

  const form = useForm<NewLeaveForm>({
    resolver: zodResolver(newLeaveSchema),
    defaultValues: {
      employee_id: "",
      type: "annual",
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      reason: "",
    },
  })

  const onSubmit = (values: NewLeaveForm) => {
    const input: CreateLeaveRequestInput = {
      employee_id: values.employee_id,
      type: values.type,
      start_date: values.start_date,
      end_date: values.end_date,
      reason: values.reason || null,
    }
    createLeave.mutate(input, {
      onSuccess: (request) => {
        toast.success(t("leaves.createdToast"), {
          description: `${request.employee_name} · ${t(leaveTypeKeys[request.type])} — ${t("demo.toastSuffix")}`,
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
          {t("leaves.newRequest")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {t("leaves.newRequestTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("leaves.newRequestDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("employee.name")}</Label>
            <Select
              value={form.watch("employee_id")}
              onValueChange={(v) => form.setValue("employee_id", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("employee.searchPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.employee_id ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.employee_id.message}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("leaves.typeLabel")}</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) => form.setValue("type", v as LeaveType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(leaveTypeKeys[type])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-days">{t("leaves.days")}</Label>
              <Input
                id="leave-days"
                readOnly
                dir="ltr"
                className="bg-muted/50"
                value={(() => {
                  const start = new Date(form.watch("start_date")).getTime()
                  const end = new Date(form.watch("end_date")).getTime()
                  if (Number.isNaN(start) || Number.isNaN(end) || end < start)
                    return "—"
                  return String(Math.round((end - start) / 86_400_000) + 1)
                })()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-start">{t("leaves.startDate")}</Label>
              <Input
                id="leave-start"
                type="date"
                dir="ltr"
                {...form.register("start_date")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="leave-end">{t("leaves.endDate")}</Label>
              <Input
                id="leave-end"
                type="date"
                dir="ltr"
                {...form.register("end_date")}
              />
              {form.formState.errors.end_date ? (
                <p className="text-sm text-destructive">
                  {form.formState.errors.end_date.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-reason">{t("leaves.reason")}</Label>
            <Textarea
              id="leave-reason"
              rows={2}
              placeholder={t("leaves.reasonPlaceholder")}
              {...form.register("reason")}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={createLeave.isPending}>
              {createLeave.isPending
                ? t("common.loading")
                : t("common.confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function LeavesPage() {
  const { t } = useTranslation()
  const { data: leaves, isLoading } = useLeaveRequests()
  const { data: employees } = useEmployees()
  const canCreate = useCan(permission("module:leaves", "create"))

  const columns: Array<DataTableColumn<LeaveRequest>> = [
    {
      id: "employee",
      header: t("employee.name"),
      searchText: (row) => row.employee_name,
      render: (row) => (
        <span className="font-medium">{row.employee_name}</span>
      ),
    },
    {
      id: "type",
      header: t("leaves.typeLabel"),
      filterValue: (row) => row.type,
      render: (row) => t(leaveTypeKeys[row.type]),
    },
    {
      id: "dates",
      header: t("leaves.dates"),
      className: "hidden font-latin text-label md:table-cell",
      render: (row) => `${row.start_date} → ${row.end_date}`,
    },
    {
      id: "days",
      header: t("leaves.days"),
      className: "font-latin text-label",
      render: (row) => row.days,
    },
    {
      id: "reason",
      header: t("leaves.reason"),
      className: "hidden max-w-56 truncate text-muted-foreground lg:table-cell",
      render: (row) => row.reason ?? "—",
    },
    {
      id: "status",
      header: t("table.status"),
      filterValue: (row) => row.status,
      render: (row) => <StatusBadge status={row.status} />,
    },
  ]

  const filterOptions = (["pending", "approved", "rejected"] as LeaveRequestStatus[]).map(
    (status) => ({ value: status, label: t(`leaves.status.${status}`) }),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("modules.leaves.name")}
        description={t("modules.leaves.description")}
      />

      <DemoBanner />

      <DataTable
        columns={columns}
        rows={leaves ?? []}
        isLoading={isLoading}
        searchPlaceholder={t("common.search")}
        filter={{ column: columns[5], options: filterOptions }}
        toolbarActions={
          canCreate.allowed ? (
            <NewLeaveDialog
              employees={
                employees
                  ?.filter((e) => e.status !== "terminated")
                  .map((e) => ({ id: e.id, name: e.full_name })) ?? []
              }
            />
          ) : null
        }
      />
    </div>
  )
}
