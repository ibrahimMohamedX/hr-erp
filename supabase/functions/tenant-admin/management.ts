/**
 * Supabase Management API client — يعمل على الخادم فقط (Edge Function).
 *
 * ⚠️ SUPABASE_ACCESS_TOKEN يعيش كـ Edge Function secret ولا يغادر الخادم أبدًا.
 *
 * المرجع: https://supabase.com/docs/reference/api/introduction
 * (النقاط التي تعتمد على behavior غير قابل للتجربة قبل توفير إعداد فعلي
 *  موسومة بـ VERIFY عند أول استخدام حقيقي.)
 */

const API = "https://api.supabase.com"

export interface MgmtProject {
  id: string // ref
  name: string
  status: string // مثل INACTIVE / ACTIVE — VERIFY عند أول استخدام
  region: string
  // ... حقول أخرى غير مستخدمة
}

export interface MgmtApiKey {
  name: string
  api_key: string
}

function assertToken(token: string | undefined): string {
  if (!token) {
    throw new Error(
      "SUPABASE_ACCESS_TOKEN is not configured — set it as an Edge Function secret",
    )
  }
  return token
}

async function mgmtFetch(
  token: string | undefined,
  path: string,
  init?: RequestInit & { body?: unknown },
): Promise<Response> {
  const t = assertToken(token)
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${t}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  return res
}

/** إنشاء مشروع Supabase جديد */
export async function createProject(
  token: string | undefined,
  input: {
    name: string
    organization_id: string
    db_pass: string
    region: string
  },
): Promise<MgmtProject> {
  const res = await mgmtFetch(token, "/v1/projects", {
    method: "POST",
    body: {
      name: input.name,
      organization_id: input.organization_id,
      db_pass: input.db_pass,
      region: input.region,
      // خطة البنية التحتية — منفصلة تمامًا عن خطة اشتراك العميل عندنا
      plan: "pay-as-you-go",
      // VERIFY: تفعيل Auth التجريبي افتراضيًا (القيم الافتراضية كافية للنسخة الحالية)
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`create_project failed (${res.status}): ${text}`)
  }
  return (await res.json()) as MgmtProject
}

/** جلب حالة المشروع — للتحقق من الجاهزية */
export async function getProject(
  token: string | undefined,
  ref: string,
): Promise<MgmtProject> {
  const res = await mgmtFetch(token, `/v1/projects/${ref}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`get_project failed (${res.status}): ${text}`)
  }
  return (await res.json()) as MgmtProject
}

/**
 * جلب مفاتيح المشروع (anon + service_role).
 * ⚠️ anon يُخزَّن في companies (client-safe، محروس بـ RLS).
 * ⚠️ service_role لا يُخزَّن — يُستخدم فورًا إن لزم ثم يُرمى.
 */
export async function getApiKeys(
  token: string | undefined,
  ref: string,
): Promise<MgmtApiKey[]> {
  // VERIFY: بعض إصدارات الـ API تتطلب reveal=true لإظهار القيم
  const res = await mgmtFetch(token, `/v1/projects/${ref}/api-keys?reveal=true`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`get_api_keys failed (${res.status}): ${text}`)
  }
  return (await res.json()) as MgmtApiKey[]
}

/** إيقاف مشروع (بنية تحتية) — لا علاقة له بإيقاف اشتراك العميل عندنا */
export async function pauseProject(
  token: string | undefined,
  ref: string,
): Promise<void> {
  const res = await mgmtFetch(token, `/v1/projects/${ref}/pause`, {
    method: "POST",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`pause_project failed (${res.status}): ${text}`)
  }
}

/** استئناف مشروع موقوف */
export async function restoreProject(
  token: string | undefined,
  ref: string,
): Promise<void> {
  const res = await mgmtFetch(token, `/v1/projects/${ref}/restore`, {
    method: "POST",
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`restore_project failed (${res.status}): ${text}`)
  }
}

/**
 * التحقق الفعلي من اتصال مشروع (REST health مع anon key).
 * لا يعتبر أي إجراء ناجحًا قبل نجاح هذا الفحص.
 */
export async function verifyConnection(
  url: string,
  anonKey: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    })
    return res.ok
  } catch {
    return false
  }
}
