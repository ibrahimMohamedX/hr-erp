/**
 * عميل Control Plane (مشروع المنصة المركزي) — lazy singleton.
 * client-safe فقط: URL + anon key. لا مفاتيح إدارية هنا أبدًا.
 *
 * في الوضع live يلزم جلسة مستخدم منصة فعلية (Auth المشروع المركزي) —
 * ربطها المرحلة التالية بعد توفر إعداد فعلي. هيكل الاتصال جاهز هنا.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import { appEnv } from "@/config/env"

let platformClient: SupabaseClient | null = null

/** هل الـ Control Plane مضبوط؟ */
export function isPlatformBackendConfigured(): boolean {
  return appEnv.platform.isConfigured
}

/** وضع لوحة المنصة: live (مربوطة فعليًا) أو demo (بيانات محاكية موسومة) */
export function platformMode(): "live" | "demo" {
  return appEnv.platformMode
}

/** عميل مشروع المنصة — null لو غير مضبوط */
export function getPlatformClient(): SupabaseClient | null {
  if (!appEnv.platform.isConfigured) return null
  platformClient ??= createClient(appEnv.platform.url, appEnv.platform.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  })
  return platformClient
}

/**
 * استدعاء Edge Function tenant-admin برأس المصادقة الحالي.
 * (supabase-js يرفع Authorization تلقائيًا من الجلسة المثبتة على العميل)
 */
export async function invokeTenantAdmin<TRequest extends { action: string }, TResponse>(
  body: TRequest,
): Promise<{ ok: boolean; status: number; data: TResponse | null; error: string | null }> {
  const client = getPlatformClient()
  if (!client) {
    return { ok: false, status: 0, data: null, error: "platform backend not configured" }
  }
  const { data, error } = await client.functions.invoke<TResponse>("tenant-admin", {
    body,
  })
  const anyData = data as unknown as Record<string, unknown> | null
  const ok = !error && anyData?.ok !== false
  return {
    ok,
    status: ok ? 200 : 400,
    data: data ?? null,
    error: error?.message ?? (ok ? null : String(anyData?.reason ?? "request_failed")),
  }
}
