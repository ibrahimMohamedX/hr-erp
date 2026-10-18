/**
 * Platform API — طبقة موحدة بين الواجهة والـ Control Plane.
 *
 * وضعان بنفس العقد تمامًا:
 *  - live: مشروع منصة حقيقي (DB queries + Edge Function tenant-admin)
 *  - demo: المتجر المحاكي (نفس خطوات التوفير 1:1) — موسوم بوضوح
 *
 * التحول بينهما تلقائي حسب الإعداد — لا صفحة واحدة تتغير.
 */

import type {
  ActionResult,
  PlatformTenantOverview,
  ProvisionCompanyInput,
  ProvisioningAction,
  ProvisioningJob,
  SubscriptionUpdateInput,
} from "@/types"

import {
  getPlatformClient,
  invokeTenantAdmin,
  isPlatformBackendConfigured,
} from "@/lib/platform/client"

import * as demo from "./mock-db"

export interface PlatformApi {
  mode: "live" | "demo"

  fetchCompanies(): Promise<PlatformTenantOverview[]>
  fetchCompany(tenantId: string): Promise<PlatformTenantOverview | null>

  /** بدء توفير شركة جديدة — يرجع jobId للـ polling */
  startProvision(input: ProvisionCompanyInput): Promise<{ jobId: string; companyId: string }>

  /** عمل على شركة قائمة (reconnect/verify/pause/resume/reprovision) */
  startCompanyAction(
    companyId: string,
    action: Exclude<ProvisioningAction, "provision">,
  ): Promise<string>

  /** خطوة واحدة من خط التوفير — الواجهة تستدعيها دوريًا */
  pollJob(jobId: string): Promise<ProvisioningJob | null>

  /** تحديث اشتراك العميل (منتجنا) — منفصل عن البنية التحتية */
  subscriptionUpdate(input: SubscriptionUpdateInput): Promise<ActionResult>
}

// ─── تحويل صفوف قاعدة البيانات إلى النوع المطلوب ─────────────────────────

interface CompanyRow {
  id: string
  slug: string
  name: string
  status: string
  connection_state?: string
  project_ref: string | null
  project_url: string | null
  project_region: string | null
  project_infra_state: string | null
  project_connection_state: string | null
  project_anon_key: string | null
  project_last_verified_at: string | null
  created_at: string
  updated_at: string
  subscriptions: {
    id: string
    plan: string
    status: string
    seats: number | null
    current_period_start: string
    current_period_end: string
    created_at: string
    updated_at: string
  } | null
}

function rowToOverview(row: CompanyRow): PlatformTenantOverview {
  const hasProject = Boolean(row.project_ref)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    display_name: null,
    logo_url: null,
    status: (row.status as PlatformTenantOverview["status"]) ?? "inactive",
    connection_state:
      (row.project_connection_state as PlatformTenantOverview["connection_state"]) ?? "disconnected",
    project: hasProject
      ? {
          ref: row.project_ref!,
          url: row.project_url ?? "",
          region: row.project_region ?? "",
          infra_state: (row.project_infra_state as PlatformTenantOverview["project"]!["infra_state"]) ?? "unknown",
          connection_state:
            (row.project_connection_state as PlatformTenantOverview["project"]!["connection_state"]) ?? "disconnected",
          anon_key_set: Boolean(row.project_anon_key),
          last_verified_at: row.project_last_verified_at,
          created_at: row.created_at,
        }
      : null,
    subscription: row.subscriptions
      ? {
          ...row.subscriptions,
          tenant_id: row.id,
        }
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    usage: null, // مؤشرات الاستخدام تتطلب استعلام مشروع الشركة — مرحلة لاحقة
  }
}

// ─── التنفيذ الحقيقي (live) ───────────────────────────────────────────────

const liveApi: PlatformApi = {
  mode: "live",

  async fetchCompanies() {
    const client = getPlatformClient()
    const { data, error } = await client!
      .from("companies")
      .select("*, subscriptions(*)")
      .order("created_at", { ascending: false })
    if (error) throw new Error(error.message)
    return (data as unknown as CompanyRow[]).map(rowToOverview)
  },

  async fetchCompany(tenantId) {
    const client = getPlatformClient()
    const { data, error } = await client!
      .from("companies")
      .select("*, subscriptions(*)")
      .eq("id", tenantId)
      .maybeSingle()
    if (error || !data) return null
    return rowToOverview(data as unknown as CompanyRow)
  },

  async startProvision(input) {
    const res = await invokeTenantAdmin<
      { action: "provision"; name: string; slug: string; admin_email: string; plan: string; duration_months?: number },
      { ok: boolean; job_id: string; company_id: string }
    >({ action: "provision", ...input })
    if (!res.ok || !res.data) throw new Error(res.error ?? "provision failed")
    return { jobId: res.data.job_id, companyId: res.data.company_id }
  },

  async startCompanyAction(companyId, action) {
    const res = await invokeTenantAdmin<
      { action: string; company_id: string },
      { ok: boolean; job_id: string }
    >({ action, company_id: companyId })
    if (!res.ok || !res.data) throw new Error(res.error ?? "action failed")
    return res.data.job_id
  },

  async pollJob(jobId) {
    const res = await invokeTenantAdmin<
      { action: "poll"; job_id: string },
      { ok: boolean; job: ProvisioningJob }
    >({ action: "poll", job_id: jobId })
    if (!res.ok || !res.data) return null
    return res.data.job
  },

  async subscriptionUpdate(input) {
    const res = await invokeTenantAdmin<
      {
        action: "subscription.update"
        company_id: string
        update: string
        plan?: string
        duration_months?: number
      },
      ActionResult
    >({
      action: "subscription.update",
      company_id: input.company_id,
      update: input.action,
      plan: input.plan,
      duration_months: input.duration_months,
    })
    if (res.data) return res.data
    return { ok: false, message: res.error ?? "failed" }
  },
}

// ─── التنفيذ التجريبي (demo) ───────────────────────────────────────────────

const demoApi: PlatformApi = {
  mode: "demo",

  fetchCompanies: demo.fetchCompanies,
  fetchCompany: demo.fetchCompany,
  startProvision: demo.startProvisionJob,
  startCompanyAction: demo.startCompanyAction,
  pollJob: demo.fetchJob,
  subscriptionUpdate: demo.applySubscriptionUpdate,
}

/** الـ API الفعّال حسب الإعداد — live عند توفر Control Plane وإلا demo */
export function getPlatformApi(): PlatformApi {
  return isPlatformBackendConfigured() ? liveApi : demoApi
}
