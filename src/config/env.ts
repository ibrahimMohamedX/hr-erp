/**
 * الإعدادات المركزية للتطبيق — المصدر الوحيد لقراءة Environment Variables.
 * ⚠️ ممنوع قراءة import.meta.env من أي ملف آخر — كل شيء يمر من هنا.
 * ⚠️ لا تحتوي أي أسرار: كل القيم هنا عامة للعميل، والحماية عبر Supabase RLS.
 */

import { z } from "zod"

const envSchema = z.object({
  MODE: z.enum(["development", "production", "test"]),
  DEV: z.boolean(),
  VITE_SUPABASE_URL: z.string().trim().min(1).optional(),
  VITE_SUPABASE_ANON_KEY: z.string().trim().min(1).optional(),
  VITE_APP_DEFAULT_LANGUAGE: z.enum(["ar", "en"]).optional(),
  VITE_APP_DEFAULT_THEME: z.enum(["dark", "light", "system"]).optional(),
})

type RawEnv = z.infer<typeof envSchema>

const raw: Partial<RawEnv> = {
  MODE: import.meta.env.MODE as RawEnv["MODE"],
  DEV: import.meta.env.DEV,
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_APP_DEFAULT_LANGUAGE: import.meta.env.VITE_APP_DEFAULT_LANGUAGE as
    | RawEnv["VITE_APP_DEFAULT_LANGUAGE"]
    | undefined,
  VITE_APP_DEFAULT_THEME: import.meta.env.VITE_APP_DEFAULT_THEME as
    | RawEnv["VITE_APP_DEFAULT_THEME"]
    | undefined,
}

const parsed = envSchema.safeParse(raw)

if (!parsed.success) {
  // Config غير صالح: نوقف التطبيق برسالة واضحة بدلًا من سلوك غير متوقع
  console.error(
    "[config] Invalid environment variables:",
    parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  )
  throw new Error("Invalid environment configuration — see console for details")
}

const env = parsed.data

export interface SupabaseEnvConfig {
  url: string
  anonKey: string
  isConfigured: boolean
}

export interface AppEnvConfig {
  mode: "development" | "production" | "test"
  isDev: boolean
  defaultLanguage: "ar" | "en"
  defaultTheme: "dark" | "light" | "system"
  supabase: SupabaseEnvConfig
}

/**
 * إعدادات التطبيق الموحدة — اقرأها من هنا فقط.
 * لو Supabase غير مضبوط في .env.local يبقى isConfigured=false
 * وعميل Supabase يرفع خطأ واضح عند أول محاولة استخدام.
 */
export const appEnv: AppEnvConfig = {
  mode: env.MODE,
  isDev: env.DEV,
  defaultLanguage: env.VITE_APP_DEFAULT_LANGUAGE ?? "ar",
  defaultTheme: env.VITE_APP_DEFAULT_THEME ?? "dark",
  supabase: {
    url: env.VITE_SUPABASE_URL ?? "",
    anonKey: env.VITE_SUPABASE_ANON_KEY ?? "",
    isConfigured: Boolean(
      env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY,
    ),
  },
}
