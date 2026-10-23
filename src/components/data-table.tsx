/**
 * DataTable — جدول موحد احترافي فوق مكونات shadcn:
 * بحث نصي + فلاتر متعددة (AND) + ترتيب تفاعلي بالنقر على رأس العمود
 * + ترقيم صفحات + حالات تحميل وفراغ + Responsive scroll.
 *
 * ملاحظة: الترقيم والفلترة والترتيب يدويان (client-side) — مناسبان لأحجام
 * البيانات الحالية. عند الربط الفعلي بـ Supabase وحاجة server-side
 * pagination، يُستبدل بـ TanStack Table (المثبت بالفعل) دون تغيير الصفحات
 * المستهلكة.
 */

import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react"

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
import { cn } from "@/lib/utils"

export interface DataTableColumn<T> {
  id: string
  header: string
  /** نص يُستخلص للبحث — مثل (row) => row.name */
  searchText?: (row: T) => string
  /** قيمة الفلتر الاختيارية — مثل (row) => row.status */
  filterValue?: (row: T) => string
  /**
   * قيمة الترتيب — وجودها يجعل رأس العمود قابلًا للنقر للترتيب.
   * النقر الأول تصاعدي، الثاني تنازلي، الثالث إلغاء الترتيب.
   * القيم null/undefined تُوضع آخر القائمة دائمًا في الاتجاهين.
   */
  sortValue?: (row: T) => string | number
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
  /** فلاتر منسدلة متعددة — كلها تعمل معًا (AND) */
  filters?: Array<DataTableFilter<T>>
  /** @deprecated استخدم filters — يُدعم مؤقتًا لتوافق المستهلكين الحاليين */
  filter?: DataTableFilter<T>
  pageSize?: number
  toolbarActions?: ReactNode
  emptyMessage?: string
  /** إخفاء البحث كليًا في الجداول الصغيرة */
  hideSearch?: boolean
  /** نقر الصف — يجعل الصفوف قابلة للفتح (مثل فتح ملف موظف) */
  onRowClick?: (row: T) => void
}

interface SortState<T> {
  column: DataTableColumn<T>
  dir: "asc" | "desc"
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  searchPlaceholder,
  filter,
  filters,
  pageSize = 8,
  toolbarActions,
  emptyMessage,
  hideSearch = false,
  onRowClick,
}: DataTableProps<T>) {
  const { t, i18n } = useTranslation()
  const [search, setSearch] = useState("")
  /** قيمة فلترة لكل عمود — "all" أو غيابها = بدون فلتر */
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)
  const [sort, setSort] = useState<SortState<T> | null>(null)

  const activeFilters = useMemo(
    () => filters ?? (filter ? [filter] : []),
    [filters, filter],
  )

  // مقارن يتبع لغة الواجهة + ترتيب رقمي (EMP-2 قبل EMP-10)
  const collator = useMemo(
    () =>
      new Intl.Collator(i18n.language, { numeric: true, sensitivity: "base" }),
    [i18n.language],
  )

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
    for (const f of activeFilters) {
      const value = filterValues[f.column.id]
      if (value && value !== "all") {
        result = result.filter((row) => f.column.filterValue?.(row) === value)
      }
    }
    return result
  }, [rows, columns, search, activeFilters, filterValues])

  // الترتيب بعد الفلترة وقبل ترقيم الصفحات
  const sorted = useMemo(() => {
    if (!sort) return filtered
    const factor = sort.dir === "asc" ? 1 : -1
    return [...filtered].sort((a, b) => {
      const av = sort.column.sortValue?.(a)
      const bv = sort.column.sortValue?.(b)
      // القيم الناقصة آخر القائمة في الاتجاهين
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * factor
      return collator.compare(String(av), String(bv)) * factor
    })
  }, [filtered, sort, collator])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize)

  const toggleSort = (col: DataTableColumn<T>) => {
    setPage(0)
    if (!sort || sort.column.id !== col.id) {
      setSort({ column: col, dir: "asc" })
    } else if (sort.dir === "asc") {
      setSort({ column: col, dir: "desc" })
    } else {
      setSort(null)
    }
  }

  return (
    <div className="space-y-3">
      {!hideSearch || activeFilters.length > 0 ? (
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
                data-testid="table-search"
                placeholder={searchPlaceholder ?? t("common.search")}
                className="ps-9"
              />
            </div>
          ) : null}
          {activeFilters.map((f) => (
            <Select
              key={f.column.id}
              value={filterValues[f.column.id] ?? "all"}
              onValueChange={(v) => {
                setFilterValues((prev) => ({ ...prev, [f.column.id]: v }))
                setPage(0)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("table.all")}</SelectItem>
                {f.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
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
                {columns.map((col) => {
                  const sortable = col.sortValue != null
                  const isSorted = sort?.column.id === col.id
                  const SortIcon = !isSorted
                    ? ArrowUpDown
                    : sort!.dir === "asc"
                      ? ArrowUp
                      : ArrowDown
                  return (
                    <TableHead
                      key={col.id}
                      className={cn(
                        col.className,
                        sortable &&
                          "cursor-pointer select-none transition-colors hover:text-foreground",
                      )}
                      aria-sort={
                        sortable
                          ? isSorted
                            ? sort!.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                          : undefined
                      }
                      onClick={sortable ? () => toggleSort(col) : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {sortable ? (
                          <SortIcon className="size-3 opacity-70" />
                        ) : null}
                      </span>
                    </TableHead>
                  )
                })}
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
                  <TableRow
                    key={i}
                    className={cn(
                      onRowClick &&
                        "cursor-pointer transition-colors hover:bg-muted/40",
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
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

      {sorted.length > pageSize ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-latin text-label" dir="ltr">
            {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, sorted.length)} /{" "}
            {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label={t("common.previous")}
            >
              {/* في RTL يُقلب تلقائيًا: "السابق" يشير لليمين */}
              <ChevronLeft className="rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage(safePage + 1)}
              aria-label={t("common.next")}
            >
              <ChevronRight className="rtl:rotate-180" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
