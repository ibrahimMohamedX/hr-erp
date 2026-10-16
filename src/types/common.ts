/**
 * أنواع أساسية مشتركة عبر النظام كله.
 * المرجع التوثيقي: docs/01-architecture.md
 */

/** معرف UUID (يأتي من Supabase Postgres) */
export type UUID = string

/** تاريخ-وقت بصيغة ISO 8601 UTC — "2025-01-15T08:30:00Z" */
export type ISODateTime = string

/** تاريخ فقط — "2025-01-15" */
export type ISODate = string

/** وقت فقط — "08:30" */
export type TimeClock = string

/** قيمة JSON حرة — تُستخدم في القواعد التشغيلية والإعدادات القابلة للتوسع */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/** حالة أي كيان في النظام (شركة، مستخدم، موظف...) */
export type EntityStatus = "active" | "inactive" | "archived"

/** الأعمدة المشتركة (Auditing) في كل جداول قاعدة البيانات */
export interface BaseAuditableEntity {
  id: UUID
  created_at: ISODateTime
  updated_at: ISODateTime
}

/** معاملات استعلام مقسمة صفحات */
export interface PaginatedQuery {
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortDir?: "asc" | "desc"
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/** اللغات المدعومة حاليًا — قابلة للتوسع */
export type Locale = "ar" | "en"

/** نص ثنائي اللغة — المعيار في كل أسماء وعناوين الأقسام */
export interface LocalizedText {
  ar: string
  en: string
}
