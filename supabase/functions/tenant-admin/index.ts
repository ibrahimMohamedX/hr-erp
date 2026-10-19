// ═══════════════════════════════════════════════════════════════════════════
// tenant-admin — Edge Function للـ Control Plane (يعمل على الخادم فقط)
//
// المسؤوليات:
//   * إنشاء/إدارة مشاريع Supabase المستقلة لكل شركة عبر Management API
//   * خط توفير بخطوات موثقة (provisioning_jobs) — poll يقدم خطوة لكل استدعاء
//   * إدارة اشتراك العميل (منتجنا) — منفصلة عن البنية التحتية
//   * التحقق من صلاحيات المستدعي: platform_users فقط
//
// الأسرار المطلوبة (Edge Function secrets — لا تدخل الواجهة أبدًا):
//   SUPABASE_ACCESS_TOKEN    Personal Access Token بصلاحيات Management API
//   SUPABASE_SERVICE_ROLE_KEY  service_role لمشروع المنصة
//   SUPABASE_ORG_ID          معرف الـ organization التي تُنشأ تحتها المشاريع
//   PROVISION_REGION         المنطقة الافتراضية (اختياري — eu-central-1)
//
// النشر: راجع supabase/README.md
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

import {
  createProject,
  getApiKeys,
  getProject,
  pauseProject,
  restoreProject,
  runSql,
  verifyConnection,
} from "./management.ts"
import {
  bumpTries,
  initialSteps,
  markDone,
  markFailed,
  markRunning,
  openStep,
  type JobRecord,
} from "./pipeline.ts"
import { TENANT_SCHEMA_SQL } from "./tenant-schema.ts"
import type { AdminRequest, ActionResult, ProvisioningJob } from "./types.ts"

const PLATFORM_URL = Deno.env.get("SUPABASE_URL") ?? ""
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const ACCESS_TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN")
const ORG_ID = Deno.env.get("SUPABASE_ORG_ID")
const REGION = Deno.env.get("PROVISION_REGION") ?? "eu-central-1"

/**
 * ميزانية محاولات verify_connection لكل نوع مهمة:
 * - استئناف مشروع موقوف يستغرق دقائق فميزانيته أكبر (كل محاولة = استدعاء poll)
 */
const VERIFY_BUDGETS: Record<string, number> = {
  provision: 10,
  reprovision: 10,
  reconnect: 10,
  verify: 10,
  pause_infra: 5,
  resume_infra: 60,
}

const JOB_TIMEOUT_MIN = 30

const CORS = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function admin(): SupabaseClient {
  if (!SERVICE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY secret is not configured")
  }
  return createClient(PLATFORM_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** التحقق من هوية المستدعي: platform_users فقط */
async function requirePlatformAdmin(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization") ?? ""
  const token = auth.replace("Bearer ", "").trim()
  if (!token) throw new AuthError(401, "missing bearer token")

  const db = admin()
  const { data: userData, error: userErr } = await db.auth.getUser(token)
  if (userErr || !userData.user) throw new AuthError(401, "invalid token")

  const { data: adminRow } = await db
    .from("platform_users")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle()

  if (!adminRow) throw new AuthError(403, "not a platform admin")
  return userData.user.id
}

class AuthError extends Error {
  constructor(public status: number, public reason: string) {
    super(reason)
  }
}

// ─── تحميل/حفظ المهمة ────────────────────────────────────────────────────────

async function loadJob(db: SupabaseClient, jobId: string): Promise<JobRecord | null> {
  const { data } = await db
    .from("provisioning_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle()
  if (!data) return null
  return { ...(data as ProvisioningJob), scratch: {} }
}

async function saveJob(db: SupabaseClient, job: JobRecord): Promise<void> {
  await db
    .from("provisioning_jobs")
    .update({
      status: job.status,
      steps: job.steps,
      error: job.error,
      finished_at: job.finished_at,
    })
    .eq("id", job.id)
}

async function createJob(
  db: SupabaseClient,
  companyId: string,
  action: string,
): Promise<ProvisioningJob> {
  const { data, error } = await db
    .from("provisioning_jobs")
    .insert({
      company_id: companyId,
      action,
      status: "queued",
      steps: initialSteps(action),
    })
    .select()
    .single()
  if (error || !data) throw new Error(`create_job failed: ${error?.message}`)
  return { ...(data as ProvisioningJob), scratch: {} }
}

// ─── Company helpers ────────────────────────────────────────────────────────

async function getCompany(db: SupabaseClient, id: string) {
  const { data } = await db.from("companies").select("*").eq("id", id).maybeSingle()
  return data as Record<string, unknown> | null
}

async function updateCompany(
  db: SupabaseClient,
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { error } = await db.from("companies").update(patch).eq("id", id)
  if (error) throw new Error(`update_company failed: ${error.message}`)
}

function dbPassword(): string {
  // كلمة مرور قوية للمشروع — إما مخزنة كـ secret أو مولدة
  const provided = Deno.env.get("PROVISION_DB_PASS")
  if (provided) return provided
  const raw = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(raw, (b) => b.toString(16).padStart(2, "0")).join("")
}

// ─── الخطوات الفعلية (تُنفذ داخل poll) ─────────────────────────────────────

async function advanceJob(db: SupabaseClient, job: JobRecord): Promise<JobRecord> {
  const step = job.steps.find((s) => s.state === "running" || s.state === "pending")
  if (!step) {
    if (job.status !== "failed") {
      job.status = "succeeded"
      job.finished_at = new Date().toISOString()
      await saveJob(db, job)
    }
    return job
  }

  const company = await getCompany(db, job.company_id)
  if (!company) {
    markFailed(job, step.key, "company row disappeared")
    await saveJob(db, job)
    return job
  }

  const ref = (company.project_ref as string | null) ?? job.scratch.ref ?? undefined
  markRunning(job, step.key)

  try {
    switch (step.key) {
      case "register_company": {
        // تمت عند بدء المهمة
        markDone(job, step.key, "companies row · status=provisioning")
        break
      }

      case "create_project": {
        if (!ORG_ID) throw new Error("SUPABASE_ORG_ID secret is not configured")
        const name = `${(company.slug as string).slice(0, 30)}-${Date.now() % 1000}`
        const project = await createProject(ACCESS_TOKEN, {
          name,
          organization_id: ORG_ID,
          db_pass: dbPassword(),
          region: REGION,
        })
        job.scratch.ref = project.id
        await updateCompany(db, job.company_id, {
          project_ref: project.id,
          project_region: project.region ?? REGION,
          project_infra_state: "inactive",
          // reprovision: مشروع جديد = مدير جديد يُدعى لاحقًا في create_admin
          admin_user_id: null,
          admin_invited_at: null,
        })
        markDone(job, step.key, `ref: ${project.id} · region: ${project.region}`)
        break
      }

      case "wait_healthy": {
        if (!ref) throw new Error("no project ref")
        const project = await getProject(ACCESS_TOKEN, ref)
        // VERIFY: قيم status المعتمدة تُثبت عند أول استخدام فعلي
        if (String(project.status).toUpperCase() === "ACTIVE") {
          await updateCompany(db, job.company_id, { project_infra_state: "active" })
          markDone(job, step.key, `status: ${project.status}`)
        } else {
          // ما زال غير جاهز — الخطوة تظل running ويُعاد poll
          step.detail = `status: ${project.status} — waiting`
          step.at = new Date().toISOString()
        }
        break
      }

      case "fetch_api_keys": {
        if (!ref) throw new Error("no project ref")
        const keys = await getApiKeys(ACCESS_TOKEN, ref)
        const anon = keys.find((k) => k.name === "anon")
        if (!anon) throw new Error("anon key not found in api keys")
        await updateCompany(db, job.company_id, {
          project_anon_key: anon.api_key,
          project_url: `https://${ref}.supabase.co`,
        })
        markDone(job, step.key, "anon stored · service_role never persisted")
        break
      }

      case "apply_schema": {
        // تطبيق نواة الـ schema المشتركة (profiles + RLS) داخل مشروع الشركة
        if (!ref) throw new Error("no project ref")
        await runSql(ACCESS_TOKEN, ref, TENANT_SCHEMA_SQL)
        markDone(job, step.key, "core schema + RLS applied (idempotent)")
        break
      }

      case "create_admin": {
        // أول حساب مدير للشركة عبر دعوة بالبريد — بكلمة مرور يحددها هو
        // ⚠️ service_role يُجلب للاستخدام الفوري في هذه الخطوة فقط ولا يُخزَّن.
        // VERIFY: inviteUserByEmail يتطلب SMTP مضبوطًا في مشروع الشركة.
        if (!ref) throw new Error("no project ref")
        const adminEmail = company.admin_email as string | null
        if (!adminEmail) throw new Error("company admin_email missing")

        const keys = await getApiKeys(ACCESS_TOKEN, ref)
        const serviceKey = keys.find((k) => k.name === "service_role")?.api_key
        if (!serviceKey) throw new Error("service_role key not returned by api")

        const tenant = createClient(
          `https://${ref}.supabase.co`,
          serviceKey,
          { auth: { persistSession: false, autoRefreshToken: false } },
        )

        const { data: invite, error: inviteErr } =
          await tenant.auth.admin.inviteUserByEmail(adminEmail)
        if (inviteErr || !invite?.user?.id) {
          throw new Error(`invite failed: ${inviteErr?.message ?? "no user id"}`)
        }

        // صف الـ profile يُنشأ الآن (service_role يتجاوز RLS بحكم التصميم)
        const { error: profileErr } = await tenant.from("profiles").insert({
          user_id: invite.user.id,
          full_name: `${company.name} Admin`,
          role: "company_admin",
        })
        if (profileErr) {
          throw new Error(`profile insert failed: ${profileErr.message}`)
        }

        await updateCompany(db, job.company_id, {
          admin_user_id: invite.user.id,
          admin_invited_at: new Date().toISOString(),
        })
        markDone(job, step.key, `invite sent to ${adminEmail}`)
        break
      }

      case "verify_connection": {
        const url = company.project_url as string | null
        const anon = company.project_anon_key as string | null
        if (!url || !anon) throw new Error("connection info incomplete")
        const budget = VERIFY_BUDGETS[job.action] ?? 10
        const ok = await verifyConnection(url, anon)
        if (ok) {
          await updateCompany(db, job.company_id, {
            project_connection_state: "connected",
            project_last_verified_at: new Date().toISOString(),
          })
          markDone(job, step.key, "REST health ok")
        } else {
          // العدّاد محفوظ داخل الخطوة (steps jsonb) — لا يتصفر بين الاستدعاءات
          const tries = bumpTries(step)
          step.detail = `attempt ${tries}/${budget} — retrying`
          if (tries >= budget) {
            throw new Error(`connection not verified after ${tries} attempts`)
          }
        }
        break
      }

      case "verify_paused": {
        // دلالة الإيقاف: النجاح = المشروع موقوف فعلًا (لا نجاح اتصال!)
        if (!ref) throw new Error("no project ref")
        const project = await getProject(ACCESS_TOKEN, ref)
        // VERIFY: قيمة status للمشروع الموقوف تُثبَّت عند أول استخدام فعلي
        if (String(project.status).toUpperCase() === "PAUSED") {
          await updateCompany(db, job.company_id, {
            project_infra_state: "paused",
            project_connection_state: "disconnected",
          })
          markDone(job, step.key, `status: ${project.status}`)
        } else {
          const tries = bumpTries(step)
          step.detail = `status: ${project.status} — waiting (${tries})`
        }
        break
      }

      case "pause_project": {
        if (!ref) throw new Error("no project ref")
        await pauseProject(ACCESS_TOKEN, ref)
        markDone(job, step.key, "pause requested")
        break
      }

      case "resume_project": {
        if (!ref) throw new Error("no project ref")
        await restoreProject(ACCESS_TOKEN, ref)
        markDone(job, step.key, "restore requested")
        break
      }

      case "finalize": {
        const patch: Record<string, unknown> = {
          project_connection_state: "connected",
          project_last_verified_at: new Date().toISOString(),
        }
        if (job.action === "provision" || job.action === "reprovision") {
          patch.status = "active"
        }
        if (job.action === "pause_infra") {
          patch.project_infra_state = "paused"
          patch.project_connection_state = "disconnected"
        }
        if (job.action === "resume_infra") {
          patch.project_infra_state = "active"
        }
        await updateCompany(db, job.company_id, patch)
        markDone(job, step.key, "company state updated")
        job.status = "succeeded"
        job.finished_at = new Date().toISOString()
        break
      }

      default:
        throw new Error(`unknown step: ${step.key}`)
    }
  } catch (err) {
    markFailed(job, step.key, (err as Error).message)
  }

  await saveJob(db, job)
  return job
}

// ─── الأعمال الرئيسية ───────────────────────────────────────────────────────

async function handleProvision(db: SupabaseClient, req: Extract<AdminRequest, { action: "provision" }>) {
  // Idempotency: منع slug مكرر — فحص مسبق + قيد فريد كخط دفاع ثانٍ
  const { data: existing } = await db
    .from("companies")
    .select("id, name")
    .eq("slug", req.slug)
    .maybeSingle()
  if (existing) {
    return json(
      { ok: false, reason: "slug_taken", message: "slug already exists" },
      409,
    )
  }

  // 1) تسجيل الشركة + الاشتراك + المهمة
  const months = req.duration_months ?? 12
  const start = new Date()
  const end = new Date(Date.now() + months * 30 * 86_400_000)

  const { data: company, error: companyErr } = await db
    .from("companies")
    .insert({
      slug: req.slug,
      name: req.name,
      admin_email: req.admin_email,
      status: "provisioning",
    })
    .select()
    .single()
  if (companyErr || !company) {
    // قيد الفريد قد يسبقنا في بيئة متزامنة — نفس المعنى: slug_taken
    if (companyErr?.message?.includes("duplicate key")) {
      return json(
        { ok: false, reason: "slug_taken", message: "slug already exists" },
        409,
      )
    }
    return json({ ok: false, reason: "insert_failed", message: companyErr?.message }, 400)
  }

  await db.from("subscriptions").insert({
    tenant_id: company.id,
    plan: req.plan,
    status: "trialing",
    current_period_start: start.toISOString().slice(0, 10),
    current_period_end: end.toISOString().slice(0, 10),
  })

  const job = await createJob(db, company.id, "provision")

  // 2) register_company + create_project — تنفيذ فوري (الانتظار يترك للـ poll)
  const record = await loadJob(db, job.id)
  if (!record) return json({ ok: false, reason: "job_missing" }, 500)
  const advanced = await advanceJob(db, record) // register_company → done
  const advanced2 = await advanceJob(db, advanced) // create_project (فوري)

  return json({
    ok: advanced2.status !== "failed",
    job_id: job.id,
    company_id: company.id,
    job: advanced2,
  })
}

async function handleCompanyAction(
  db: SupabaseClient,
  req: Extract<AdminRequest, { action: string; company_id: string }>,
) {
  // Idempotency: مهمة نشطة بنفس النوع على نفس الشركة → نرجعها كما هي
  // (بدل إنشاء مكرر عند الضغط المزدوج أو إعادة المحاولة المتزامنة)
  const { data: active } = await db
    .from("provisioning_jobs")
    .select("id")
    .eq("company_id", req.company_id)
    .eq("action", req.action)
    .in("status", ["queued", "running"])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (active) {
    return json({ ok: true, job_id: active.id, existing: true })
  }

  const job = await createJob(db, req.company_id, req.action)

  // pause/resume: ننفذ طلب البنية فورًا ثم يتحقق الـ poll من النتيجة
  if (req.action === "pause_infra" || req.action === "resume_infra") {
    const record = await loadJob(db, job.id)
    if (!record) return json({ ok: false, reason: "job_missing" }, 500)
    const advanced = await advanceJob(db, record)
    return json({ ok: advanced.status !== "failed", job_id: job.id, job: advanced })
  }

  return json({ ok: true, job_id: job.id })
}

async function handleSubscription(
  db: SupabaseClient,
  req: Extract<AdminRequest, { action: "subscription.update" }>,
): Promise<Response> {
  const company = await getCompany(db, req.company_id)
  if (!company) return json({ ok: false, reason: "not_found" }, 404)

  const patch: Record<string, unknown> = {}
  const months = req.duration_months ?? 1
  const end = new Date(Date.now() + months * 30 * 86_400_000).toISOString().slice(0, 10)

  switch (req.update) {
    case "activate": {
      // ⚠️ التفعيل مرهون باتصال مشروع مُتحقق منه — لا تفعيل بدون مشروع يعمل
      if (company.project_connection_state !== "connected") {
        const result: ActionResult = {
          ok: false,
          reason: "project_not_verified",
          message: "Cannot activate before the project connection is verified",
        }
        return json(result, 409)
      }
      patch.status = "active"
      patch.current_period_start = new Date().toISOString().slice(0, 10)
      patch.current_period_end = end
      break
    }
    case "suspend":
      // تعليق اشتراك العميل (منتجنا) — لا يوقف مشروع البنية التحتية
      patch.status = "suspended"
      break
    case "renew":
      patch.status = "active"
      patch.current_period_end = end
      break
    case "change_plan":
      if (!req.plan) return json({ ok: false, reason: "plan_missing" }, 400)
      patch.plan = req.plan
      break
    case "set_duration":
      patch.current_period_end = end
      break
  }

  const { error } = await db
    .from("subscriptions")
    .update(patch)
    .eq("tenant_id", req.company_id)
  if (error) return json({ ok: false, reason: "update_failed", message: error.message }, 500)

  const result: ActionResult = { ok: true, message: "subscription updated" }
  return json(result)
}

async function handlePoll(db: SupabaseClient, jobId: string): Promise<Response> {
  const job = await loadJob(db, jobId)
  if (!job) return json({ ok: false, reason: "job_not_found" }, 404)

  // حارس المهلة: مهمة أقدم من 30 دقيقة تُعتبر فاشلة — على الخطوة المفتوحة الفعلية
  const ageMin = (Date.now() - new Date(job.started_at).getTime()) / 60_000
  if (job.status === "running" && ageMin > JOB_TIMEOUT_MIN) {
    const stuck = openStep(job)
    markFailed(job, stuck?.key ?? "wait_healthy", `job exceeded ${JOB_TIMEOUT_MIN} minutes`)
    await saveJob(db, job)
  } else if (job.status === "queued" || job.status === "running") {
    await advanceJob(db, job)
  }

  return json({ ok: true, job })
}

// ─── Entry ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS })

  if (req.method !== "POST") {
    return json({ ok: false, reason: "method_not_allowed" }, 405)
  }

  try {
    await requirePlatformAdmin(req)

    const body = (await req.json()) as AdminRequest
    const db = admin()

    switch (body.action) {
      case "provision":
        return await handleProvision(db, body)
      case "reprovision":
      case "reconnect":
      case "verify":
      case "pause_infra":
      case "resume_infra":
        return await handleCompanyAction(db, body)
      case "subscription.update":
        return await handleSubscription(db, body)
      case "poll":
        return await handlePoll(db, body.job_id)
      default:
        return json({ ok: false, reason: "unknown_action" }, 400)
    }
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ ok: false, reason: err.reason }, err.status)
    }
    return json({ ok: false, reason: "server_error", message: (err as Error).message }, 500)
  }
})
