/// <reference types="vite/client" />

/**
 * تعريف متغيرات البيئة الخاصة بالتطبيق (VITE_*)
 * القيم متاحة للعميل — لا تضع هنا أي أسرار.
 * المرجع: .env.example
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_APP_DEFAULT_LANGUAGE?: string
  readonly VITE_APP_DEFAULT_THEME?: string
}
