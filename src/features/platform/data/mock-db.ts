/**
 * ⚠️ بيانات تجريبية (Mock) — منطقة المنصة بنموذج "مشروع مستقل لكل شركة".
 *
 * عند غياب إعداد الـ Control Plane الحقيقي (VITE_PLATFORM_SUPABASE_*)
 * تعمل اللوحة بهذا المتجر المحاكي: شركات بمشاريع demo + خط توفير
 * محاكى بنفس خطوات الـ Edge Function الحقيقي (1:1) — بحيث التحول
 * للربط الفعلي لا يغيّر الواجهة.
 *
 * ⚠️ refs وروابط المشاريع هنا نمطية تجريبية (demo-*.supabase.co)
 *    وليست مشاريع حقيقية.
 */

import type {
  ActionResult,
  ProvisioningAction,
  ProvisioningJob,
  ProvisioningStep,
  ProvisionCompanyInput,
  SubscriptionUpdateInput,
} from "@/types"
import type {
  CreateTenantInput,
  PlatformTenantOverview,
  SubscriptionPlanKey,
  SubscriptionStatus,
  TenantConnectionState,
  UUID,
} from "@/types"

const now = () => new Date().toISOString()
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString()

// ─── البذور ────────────────────────────────────────────────────────────────

interface MockCompanySeed {
  slug: string
  name: string
  status: "active" | "inactive"
  connection: TenantConnectionState
  projectRef: string
  region: string
  infraState: "active" | "paused" | "inactive"
  plan: SubscriptionPlanKey
  subStatus: SubscriptionStatus
  seats: number
  activeUsers: number
  employees: number
  storageMb: number
  ageDays: number
  lastActivityHours: number
  failedProvision?: boolean
}

const SEED: MockCompanySeed[] = [
  { slug: "nawa-tech", name: "نُوى تك", status: "active", connection: "connected", projectRef: "demo-nawat3ch7x", region: "eu-central-1", infraState: "active", plan: "enterprise", subStatus: "active", seats: 120, activeUsers: 86, employees: 84, storageMb: 18_400, ageDays: 426, lastActivityHours: 1 },
  { slug: "horizon-group", name: "مجموعة أفق", status: "active", connection: "connected", projectRef: "demo-horizon9k", region: "eu-central-1", infraState: "active", plan: "growth", subStatus: "active", seats: 60, activeUsers: 47, employees: 52, storageMb: 9_800, ageDays: 318, lastActivityHours: 3 },
  { slug: "alwirs-ha", name: "مصنع الورشة", status: "active", connection: "connected", projectRef: "demo-wersha2m", region: "me-central-1", infraState: "active", plan: "starter", subStatus: "active", seats: 25, activeUsers: 19, employees: 21, storageMb: 2_300, ageDays: 201, lastActivityHours: 26 },
  { slug: "meda-clinics", name: "عيادات ميدا", status: "active", connection: "degraded", projectRef: "demo-medacli4q", region: "eu-central-1", infraState: "active", plan: "growth", subStatus: "past_due", seats: 40, activeUsers: 31, employees: 36, storageMb: 4_100, ageDays: 262, lastActivityHours: 9 },
  { slug: "seif-logistics", name: "سيف لوجستكس", status: "active", connection: "connected", projectRef: "demo-seiflog1", region: "me-central-1", infraState: "active", plan: "starter", subStatus: "trialing", seats: 15, activeUsers: 8, employees: 11, storageMb: 900, ageDays: 12, lastActivityHours: 2 },
  { slug: "bayan-media", name: "بيان ميديا", status: "active", connection: "disconnected", projectRef: "demo-bayanmd6", region: "eu-central-1", infraState: "paused", plan: "growth", subStatus: "suspended", seats: 30, activeUsers: 0, employees: 24, storageMb: 3_500, ageDays: 402, lastActivityHours: 780 },
  { slug: "rowad-academy", name: "أكاديمية رواد", status: "active", connection: "connected", projectRef: "demo-rowadac3", region: "eu-central-1", infraState: "active", plan: "starter", subStatus: "active", seats: 20, activeUsers: 14, employees: 16, storageMb: 1_400, ageDays: 74, lastActivityHours: 5 },
  { slug: "tayeb-foods", name: "طيّب للصناعات الغذائية", status: "inactive", connection: "disconnected", projectRef: "demo-tayebfd8", region: "me-central-1", infraState: "inactive", plan: "starter", subStatus: "cancelled", seats: 10, activeUsers: 0, employees: 9, storageMb: 600, ageDays: 511, lastActivityHours: 2_100 },
  { slug: "noor-retail", name: "نور للتجزئة", status: "active", connection: "connected", projectRef: null, region: "eu-central-1", infraState: "inactive", plan: "starter", subStatus: "trialing", seats: 10, activeUsers: 0, employees: 0, storageMb: 0, ageDays: 0, lastActivityHours: 0, failedProvision: true },
]

function seedToCompany(seed: MockCompanySeed, index: number): PlatformTenantOverview {
  const id = `mock-tenant-${String(index + 1).padStart(3, "0")}`
  const periodStart = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10)
  const periodEnd = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10)

  return {
    id,
    slug: seed.slug,
    name: seed.name,
    display_name: null,
    logo_url: null,
    status: seed.status,
    connection_state: seed.connection,
    project: seed.projectRef
      ? {
          ref: seed.projectRef,
          url: `https://${seed.projectRef}.supabase.co`,
          region: seed.region,
          infra_state: seed.infraState,
          connection_state: seed.connection,
          anon_key_set: !seed.failedProvision,
          last_verified_at: seed.failedProvision ? null : daysAgo(1),
          created_at: daysAgo(seed.ageDays),
        }
      : null,
    subscription: {
      id: `mock-sub-${index + 1}`,
      created_at: daysAgo(seed.ageDays),
      updated_at: daysAgo(7),
      tenant_id: id,
      plan: seed.plan,
      status: seed.subStatus,
      seats: seed.seats,
      current_period_start: periodStart,
      current_period_end: periodEnd,
    },
    created_at: daysAgo(seed.ageDays),
    updated_at: daysAgo(3),
    usage: {
      tenant_id: id,
      active_users: seed.activeUsers,
      employee_count: seed.employees,
      storage_used_mb: seed.storageMb,
      last_activity_at: new Date(Date.now() - seed.lastActivityHours * 3_600_000).toISOString(),
    },
  }
}

const store: PlatformTenantOverview[] = SEED.map(seedToCompany)
const jobs = new Map<string, ProvisioningJob>()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── الشركات ──────────────────────────────────────────────────────────────

export async function fetchCompanies(): Promise<PlatformTenantOverview[]> {
  await delay(320)
  return [...store]
}

export async function fetchCompany(
  tenantId: string,
): Promise<PlatformTenantOverview | null> {
  await delay(260)
  const found = store.find((c) => c.id === tenantId)
  return found ? { ...found } : null
}

// ─── خطوات التوفير — نفس خطوات الـ Edge Function الحقيقي (1:1) ─────────────

const provisionSteps = (action: ProvisioningAction): Array<{ key: string; ms: number; detail?: string }> => {
  switch (action) {
    case "provision":
      return [
        { key: "register_company", ms: 450, detail: "companies row · status=provisioning" },
        { key: "create_project", ms: 900, detail: "Management API · POST /v1/projects" },
        { key: "wait_healthy", ms: 1300, detail: "poll project status" },
        { key: "fetch_api_keys", ms: 600, detail: "anon stored · service_role server-only" },
        { key: "verify_connection", ms: 700, detail: "REST health + anon key" },
        { key: "finalize", ms: 400, detail: "company active · subscription trialing" },
      ]
    case "reprovision":
      return [
        { key: "create_project", ms: 900, detail: "new project via Management API" },
        { key: "wait_healthy", ms: 1200 },
        { key: "fetch_api_keys", ms: 600 },
        { key: "verify_connection", ms: 700 },
        { key: "finalize", ms: 400 },
      ]
    case "reconnect":
      return [
        { key: "fetch_api_keys", ms: 600, detail: "re-fetch from Management API" },
        { key: "verify_connection", ms: 700, detail: "REST health" },
        { key: "finalize", ms: 300, detail: "connection_state=connected" },
      ]
    case "verify":
      return [
        { key: "verify_connection", ms: 700, detail: "REST health + anon key" },
        { key: "finalize", ms: 250, detail: "last_verified_at updated" },
      ]
    case "pause_infra":
      return [
        { key: "pause_project", ms: 900, detail: "Management API · POST pause" },
        { key: "verify_connection", ms: 500, detail: "confirm paused state" },
      ]
    case "resume_infra":
      return [
        { key: "resume_project", ms: 1100, detail: "Management API · POST restore" },
        { key: "verify_connection", ms: 700, detail: "confirm healthy" },
      ]
  }
}

/** تشغيل مهمة توفير محاكاة — تحدّث المتجر خطوة بخطوة */
function runDemoJob(jobId: string) {
  const job = jobs.get(jobId)
  if (!job) return
  const company = store.find((c) => c.id === job.company_id)
  const spec = provisionSteps(job.action)

  void (async () => {
    job.status = "running"
    for (const step of spec) {
      const current: ProvisioningStep = {
        key: step.key,
        state: "running",
        at: now(),
      }
      job.steps.push(current)
      await delay(step.ms)

      // نجاح الخطوة — بعد التحقق من نتيجتها
      current.state = "done"
      current.detail = step.detail ?? current.detail
      current.at = now()

      // تحديثات جانبية على الشركة حسب الخطوة
      if (step.key === "create_project" && company) {
        const slugPart = company.slug.slice(0, 10).replace(/-+$/, "") || "tenant"
        company.project = {
          ref: `demo-${slugPart}${Math.floor(Math.random() * 90 + 10)}`,
          url: "",
          region: "eu-central-1",
          infra_state: "inactive",
          connection_state: "disconnected",
          anon_key_set: false,
          last_verified_at: null,
          created_at: now(),
        }
        company.project.url = `https://${company.project.ref}.supabase.co`
        job.steps[job.steps.length - 1].detail = `ref: ${company.project.ref}`
      }
      if (step.key === "fetch_api_keys" && company?.project) {
        company.project.anon_key_set = true
      }
      if (step.key === "verify_connection" && company?.project) {
        company.project.connection_state = "connected"
        company.project.infra_state = "active"
        company.project.last_verified_at = now()
        company.connection_state = "connected"
      }
      if (step.key === "pause_project" && company?.project) {
        company.project.infra_state = "paused"
        company.project.connection_state = "disconnected"
        company.connection_state = "disconnected"
      }
      if (step.key === "resume_project" && company?.project) {
        company.project.infra_state = "active"
      }
    }

    job.status = "succeeded"
    job.finished_at = now()

    if (company) {
      company.updated_at = now()
      if (job.action === "provision" || job.action === "reprovision") {
        company.status = "active"
        if (company.subscription) company.subscription.status = "trialing"
      }
    }
  })()
}

export async function startProvisionJob(
  input: ProvisionCompanyInput,
): Promise<{ jobId: string; companyId: string }> {
  await delay(200)

  // شركة جديدة (provision) أو شركة قائمة (actions أخرى)
  const isProvision = true
  let companyId = ""

  if (isProvision) {
    const id: UUID = `mock-tenant-${String(store.length + 1).padStart(3, "0")}`
    const today = now().slice(0, 10)
    const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)

    const company: PlatformTenantOverview = {
      id,
      slug: input.slug,
      name: input.name,
      display_name: null,
      logo_url: null,
      status: "inactive", // حتى اكتمال التوفير والتحقق
      connection_state: "disconnected",
      project: null,
      subscription: {
        id: `mock-sub-${store.length + 1}`,
        created_at: now(),
        updated_at: now(),
        tenant_id: id,
        plan: input.plan,
        status: "trialing",
        seats: null,
        current_period_start: today,
        current_period_end: in30,
      },
      created_at: now(),
      updated_at: now(),
      usage: {
        tenant_id: id,
        active_users: 0,
        employee_count: 0,
        storage_used_mb: 0,
        last_activity_at: now(),
      },
    }
    store.push(company)
    companyId = id
  }

  const jobId = `job-${Date.now()}`
  const job: ProvisioningJob = {
    id: jobId,
    company_id: companyId,
    action: "provision",
    status: "queued",
    steps: [],
    error: null,
    started_at: now(),
    finished_at: null,
  }
  jobs.set(jobId, job)
  runDemoJob(jobId)
  return { jobId, companyId }
}

export async function startCompanyAction(
  companyId: string,
  action: Exclude<ProvisioningAction, "provision">,
): Promise<string> {
  await delay(150)
  const jobId = `job-${Date.now()}`
  const job: ProvisioningJob = {
    id: jobId,
    company_id: companyId,
    action,
    status: "queued",
    steps: [],
    error: null,
    started_at: now(),
    finished_at: null,
  }
  jobs.set(jobId, job)
  runDemoJob(jobId)
  return jobId
}

export async function fetchJob(jobId: string): Promise<ProvisioningJob | null> {
  const job = jobs.get(jobId)
  return job ? { ...job } : null
}

// ─── الاشتراك (منتجنا) — منفصل عن البنية التحتية ──────────────────────────

const monthsFromNow = (n: number) =>
  new Date(Date.now() + n * 30 * 86_400_000).toISOString().slice(0, 10)

export async function applySubscriptionUpdate(
  input: SubscriptionUpdateInput,
): Promise<ActionResult> {
  await delay(400)
  const company = store.find((c) => c.id === input.company_id)
  if (!company?.subscription) {
    return { ok: false, message: "company not found", reason: "not_found" }
  }

  const sub = company.subscription
  switch (input.action) {
    case "activate":
      if (company.project?.connection_state !== "connected") {
        return { ok: false, message: "لا يمكن التفعيل قبل التحقق من اتصال المشروع", reason: "project_not_verified" }
      }
      sub.status = "active"
      sub.current_period_start = now().slice(0, 10)
      sub.current_period_end = monthsFromNow(input.duration_months ?? 1)
      break
    case "suspend":
      sub.status = "suspended"
      break
    case "renew":
      sub.status = "active"
      sub.current_period_end = monthsFromNow(input.duration_months ?? 1)
      break
    case "change_plan":
      if (input.plan) sub.plan = input.plan
      break
    case "set_duration":
      sub.current_period_end = monthsFromNow(input.duration_months ?? 12)
      break
  }
  sub.updated_at = now()
  company.updated_at = now()
  return { ok: true, message: "subscription updated (demo)" }
}

// ─── مؤشرات ────────────────────────────────────────────────────────────────

export function computePlatformStats(companies: PlatformTenantOverview[]) {
  return {
    total: companies.length,
    connected: companies.filter((c) => c.connection_state === "connected").length,
    degraded: companies.filter((c) => c.connection_state === "degraded").length,
    disconnected: companies.filter((c) => c.connection_state === "disconnected").length,
    withProject: companies.filter((c) => c.project !== null).length,
    pausedInfra: companies.filter((c) => c.project?.infra_state === "paused").length,
    activeSubscriptions: companies.filter(
      (c) => c.subscription?.status === "active" || c.subscription?.status === "trialing",
    ).length,
    totalUsers: companies.reduce((sum, c) => sum + (c.usage?.active_users ?? 0), 0),
    totalEmployees: companies.reduce((sum, c) => sum + (c.usage?.employee_count ?? 0), 0),
    bySubscriptionStatus: companies.reduce<Record<SubscriptionStatus, number>>(
      (acc, c) => {
        const status = c.subscription?.status ?? "cancelled"
        acc[status] = (acc[status] ?? 0) + 1
        return acc
      },
      { trialing: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0, expired: 0 },
    ),
  }
}

// ملاحظة توافقية: createCompany القديم — أُبقي لتجنب كسر أي استيراد قديم
export async function createCompany(
  input: CreateTenantInput,
): Promise<PlatformTenantOverview> {
  const { companyId } = await startProvisionJob({
    name: input.name,
    slug: input.slug,
    admin_email: input.admin_email,
    plan: input.plan,
  })
  const company = store.find((c) => c.id === companyId)
  return { ...company! }
}
