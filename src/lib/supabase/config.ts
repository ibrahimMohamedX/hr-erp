/**
 * إعداد Supabase — يقرأ من الإعدادات المركزية فقط (src/config/env.ts).
 * لا Hardcoded URLs ولا Keys إطلاقًا.
 */

import { appEnv, type SupabaseEnvConfig } from "@/config/env"

/** هل Supabase مضبوط في متغيرات البيئة؟ */
export function isSupabaseConfigured(): boolean {
  return appEnv.supabase.isConfigured
}

/**
 * إرجاع إعداد Supabase أو null لو غير مضبوط —
 * يُستخدم في أماكن تعرض حالة الإعداد بدل كسر التطبيق.
 */
export function getSupabaseConfig(): SupabaseEnvConfig | null {
  return appEnv.supabase.isConfigured ? appEnv.supabase : null
}

/**
 * إرجاع إعداد Supabase أو يرمي خطأ واضح —
 * يُستخدم في مسارات فعلاً تحتاج الاتصال بقاعدة البيانات.
 */
export function assertSupabaseConfigured(): SupabaseEnvConfig {
  if (!appEnv.supabase.isConfigured) {
    throw new Error(
      "Supabase is not configured. " +
        "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local " +
        "(see .env.example).",
    )
  }
  return appEnv.supabase
}
