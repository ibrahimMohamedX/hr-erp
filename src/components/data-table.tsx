/**
 * DataTable — جدول موحد احترافي فوق مكونات shadcn:
 * بحث نصي + فلتر اختياري + ترقيم صفحات + حالات تحميل وفراغ + Responsive scroll.
 *
 * ملاحظة: الترقيم والفلترة يدويان (client-side) — مناسبان لأحجام البيانات
 * الحالية. عند الربط الفعلي بـ Supabase وحاجة server-side pagination،
 * يُستبدل بـ TanStack Table (المثبت بالفعل) دون تغيير الصفحات المستهلكة.
 */

import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface DataTableColumn<T> {
  id: string
  header: string
  /** نص يُستخلص للبحث — مثل (row) => row.name */
  searchText?: (row: T) => string
  /** قيمة الفلتر الاختيارية — مثل (row) => row.status */
  filterValue?: (row: T) => string
  className?: string
  render: (row: T) => ReactNode
}

export interface DataTableFilter<T> {
  column: DataTableColumn<T>
  options: Array<{ value: string; label: string }>
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>
  rows: T[]
  isLoading?: boolean
  /** بحث أولي (اختياري) */
  searchPlaceholder?: string
  /** فلتر منسدل اختياري على عمود محدد */
  filter?: DataTableFilter<T>
  pageSize?: number
  toolbarActions?: ReactNode
  emptyMessage?: string
  /** إخفاء البحث كليًا في الجداول الصغيرة */
  hideSearch?: boolean
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  searchPlaceholder,
  filter,
  pageSize = 8,
  toolbarActions,
  emptyMessage,
  hideSearch = false,
}: DataTableProps<T>) {
  const { t } = useTranslation()
  const [search, setSearch] = useState("")
  const [filterValue, setFilterValue] = useState<string>("all")
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => {
    let result = rows
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((row) =>
        columns.some(
          (col) =>
            (col.searchText?.(row)?.toLowerCase().includes(q) ?? false) ||
            (typeof col.render(row) === "string" &&
              String(col.render(row)).toLowerCase().includes(q)),
        ),
      )
    }
    if (filter && filterValue !== "all") {
      result = result.filter(
        (row) => filter.column.filterValue?.(row) === filterValue,
      )
    }
    return result
  }, [rows, columns, search, filter, filterValue])

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize)

  return (
    <div className="space-y-3">
      {!hideSearch || filter ? (
        <div className="flex flex-wrap items-center gap-2">
          {!hideSearch ? (
            <div className="relative min-w-52 flex-1 sm:max-w-72">
              <Search className="absolute top-1/2 start-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                placeholder={searchPlaceholder ?? t("common.search")}
                className="ps-9"
              />
            </div>
          ) : null}
          {filter ? (
            <Select
              value={filterValue}
              onValueChange={(v) => {
                setFilterValue(v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("table.all")}</SelectItem>
                {filter.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {toolbarActions ? (
            <div className="ms-auto flex items-center gap-2">{toolbarActions}</div>
          ) : null}
        </div>
      ) : toolbarActions ? (
        <div className="flex items-center justify-end gap-2">
          {toolbarActions}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {columns.map((col) => (
                  <TableHead key={col.id} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.id}>
                        <Skeleton className="h-5 w-full max-w-32" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24">
                    <p className="text-center text-sm text-muted-foreground">
                      {emptyMessage ?? t("common.noData")}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.id} className={col.className}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {filtered.length > pageSize ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-latin text-label" dir="ltr">
            {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, filtered.length)} /{" "}
            {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label={t("common.previous")}
            >
              ‹
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              aria-label={t("common.next")}
            >
              ›
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
