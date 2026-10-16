/**
 * عميل Supabase للمتصفح — إنشاء كسول (Lazy) بنمط Singleton.
 * لا يُنشأ العميل إلا عند أول استخدام فعلي وإلا سيرفع خطأ واضحًا
 * لو متغيرات البيئة غير مضبوطة.
 *
 * ⚠️ ملاحظة أمنية: الـ ANON KEY هنا مفتاح عام للعميل.
 *    الحماية الحقيقية تأتي من Row Level Security (RLS) في قاعدة البيانات —
 *    كل جدول لازم يكون مجهزًا بسياسات RLS قبل أي استخدام فعلي.
 *    لا يجوز إدخال SERVICE_ROLE KEY في كود العميل أبدًا.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import {
  assertSupabaseConfigured,
  getSupabaseConfig,
} from "@/lib/supabase/config"

let browserClient: SupabaseClient | null = null

/** العميل الفعلي — يرمي خطأ وصفيًا لو الإعداد ناقص */
export function getSupabaseClient(): SupabaseClient {
  const config = assertSupabaseConfigured()
  browserClient ??= createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return browserClient
}

/** نسخة متساهلة ترجع null لو غير مضبوط — للـ UI التوضيحي فقط */
export function getSupabaseClientOrNull(): SupabaseClient | null {
  if (!getSupabaseConfig()) return null
  return getSupabaseClient()
}
