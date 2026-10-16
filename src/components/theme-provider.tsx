import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ComponentProps } from "react"

/**
 * Dark Mode provider.
 * الداكن هو الأساس في هوية Archai — الافتراضي: dark.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
