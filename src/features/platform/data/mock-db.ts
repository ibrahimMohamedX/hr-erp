/**
 * ⚠️ بيانات تجريبية (Mock) — منطقة المنصة.
 * لم تُربط بقاعدة بيانات فعلية بعد؛ عند اكتمال migrations (docs/05-supabase.md)
 * يستبدل هذا الملف باستدعاءات Supabase الفعلية بنفس العقود.
 *
 * المتجر في الذاكرة: التعديلات (إضافة شركة) تسري خلال الجلسة الحالية فقط.
 */

import type {
  CreateTenantInput,
  PlatformTenantOverview,
  SubscriptionPlanKey,
  SubscriptionStatus,
  TenantConnectionState,
  UUID,
} from "@/types"

const now = new Date().toISOString()
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString()

interface MockCompanySeed {
  slug: string
  name: string
  status: "active" | "inactive"
  connection: TenantConnectionState
  plan: SubscriptionPlanKey
  subStatus: SubscriptionStatus
  seats: number
  activeUsers: number
  employees: number
  storageMb: number
  ageDays: number
  lastActivityHours: number
}

const SEED: MockCompanySeed[] = [
  { slug: "nawa-tech", name: "نُوى تك", status: "active", connection: "connected", plan: "enterprise", subStatus: "active", seats: 120, activeUsers: 86, employees: 84, storageMb: 18_400, ageDays: 426, lastActivityHours: 1 },
  { slug: "horizon-group", name: "مجموعة أفق", status: "active", connection: "connected", plan: "growth", subStatus: "active", seats: 60, activeUsers: 47, employees: 52, storageMb: 9_800, ageDays: 318, lastActivityHours: 3 },
  { slug: "alwirs-ha", name: "مصنع الورشة", status: "active", connection: "connected", plan: "starter", subStatus: "active", seats: 25, activeUsers: 19, employees: 21, storageMb: 2_300, ageDays: 201, lastActivityHours: 26 },
  { slug: "meda-clinics", name: "عيادات ميدا", status: "active", connection: "degraded", plan: "growth", subStatus: "past_due", seats: 40, activeUsers: 31, employees: 36, storageMb: 4_100, ageDays: 262, lastActivityHours: 9 },
  { slug: "seif-logistics", name: "سيف لوجستكس", status: "active", connection: "connected", plan: "starter", subStatus: "trialing", seats: 15, activeUsers: 8, employees: 11, storageMb: 900, ageDays: 12, lastActivityHours: 2 },
  { slug: "bayan-media", name: "بيان ميديا", status: "active", connection: "disconnected", plan: "growth", subStatus: "suspended", seats: 30, activeUsers: 0, employees: 24, storageMb: 3_500, ageDays: 402, lastActivityHours: 780 },
  { slug: "rowad-academy", name: "أكاديمية رواد", status: "active", connection: "connected", plan: "starter", subStatus: "active", seats: 20, activeUsers: 14, employees: 16, storageMb: 1_400, ageDays: 74, lastActivityHours: 5 },
  { slug: "tayeb-foods", name: "طيّب للصناعات الغذائية", status: "inactive", connection: "disconnected", plan: "starter", subStatus: "cancelled", seats: 10, activeUsers: 0, employees: 9, storageMb: 600, ageDays: 511, lastActivityHours: 2_100 },
]

function seedToCompany(seed: MockCompanySeed, index: number): PlatformTenantOverview {
  const periodStart = new Date(Date.now() - 15 * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const periodEnd = new Date(Date.now() + 15 * 86_400_000)
    .toISOString()
    .slice(0, 10)

  return {
    id: `mock-tenant-${String(index + 1).padStart(3, "0")}`,
    slug: seed.slug,
    name: seed.name,
    display_name: null,
    logo_url: null,
    status: seed.status,
    connection_state: seed.connection,
    subscription: {
      id: `mock-sub-${index + 1}`,
      created_at: daysAgo(seed.ageDays),
      updated_at: daysAgo(7),
      tenant_id: `mock-tenant-${String(index + 1).padStart(3, "0")}`,
      plan: seed.plan,
      status: seed.subStatus,
      seats: seed.seats,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    },
    created_at: daysAgo(seed.ageDays),
    updated_at: daysAgo(3),
    usage: {
      tenant_id: `mock-tenant-${String(index + 1).padStart(3, "0")}`,
      active_users: seed.activeUsers,
      employee_count: seed.employees,
      storage_used_mb: seed.storageMb,
      last_activity_at: new Date(
        Date.now() - seed.lastActivityHours * 3_600_000,
      ).toISOString(),
    },
  }
}

/** المتجر في الذاكرة — قابل للتعديل خلال الجلسة (وضع تجريبي) */
const store: PlatformTenantOverview[] = SEED.map(seedToCompany)

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** قراءة كل الشركات (نسخة منفصلة عن المتجر) */
export async function fetchCompanies(): Promise<PlatformTenantOverview[]> {
  await delay(320)
  return [...store]
}

/** إضافة شركة جديدة للمتجر التجريبي */
export async function createCompany(
  input: CreateTenantInput,
): Promise<PlatformTenantOverview> {
  await delay(420)
  const id: UUID = `mock-tenant-${String(store.length + 1).padStart(3, "0")}`
  const today = now.slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

  const company: PlatformTenantOverview = {
    id,
    slug: input.slug,
    name: input.name,
    display_name: null,
    logo_url: null,
    status: "active",
    connection_state: "connected",
    subscription: {
      id: `mock-sub-${store.length + 1}`,
      created_at: now,
      updated_at: now,
      tenant_id: id,
      plan: input.plan,
      status: "trialing",
      seats: null,
      current_period_start: today,
      current_period_end: in30,
    },
    created_at: now,
    updated_at: now,
    usage: {
      tenant_id: id,
      active_users: 0,
      employee_count: 0,
      storage_used_mb: 0,
      last_activity_at: now,
    },
  }
  store.push(company)
  return { ...company }
}

/** إيجاد شركة واحدة */
export async function fetchCompany(
  tenantId: string,
): Promise<PlatformTenantOverview | null> {
  await delay(260)
  const found = store.find((c) => c.id === tenantId)
  return found ? { ...found } : null
}

/** مؤشرات عامة للمنصة (تُحسب من المتجر) */
export function computePlatformStats(companies: PlatformTenantOverview[]) {
  return {
    total: companies.length,
    connected: companies.filter((c) => c.connection_state === "connected")
      .length,
    degraded: companies.filter((c) => c.connection_state === "degraded").length,
    disconnected: companies.filter(
      (c) => c.connection_state === "disconnected",
    ).length,
    activeSubscriptions: companies.filter(
      (c) =>
        c.subscription?.status === "active" ||
        c.subscription?.status === "trialing",
    ).length,
    totalUsers: companies.reduce((sum, c) => sum + (c.usage?.active_users ?? 0), 0),
    totalEmployees: companies.reduce(
      (sum, c) => sum + (c.usage?.employee_count ?? 0),
      0,
    ),
    bySubscriptionStatus: companies.reduce<Record<SubscriptionStatus, number>>(
      (acc, c) => {
        const status = c.subscription?.status ?? "cancelled"
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      },
      {
        trialing: 0,
        active: 0,
        past_due: 0,
        suspended: 0,
        cancelled: 0,
        expired: 0,
      },
    ),
  }
}
