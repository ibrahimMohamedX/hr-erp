/**
 * Providers — تركيب موحد لكل Providers التطبيق بالترتيب الصحيح.
 * المرجع: docs/01-architecture.md
 */

import { type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { I18nProvider } from "@/components/i18n-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SessionProvider } from "@/features/auth/session"
import { appEnv } from "@/config/env"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        defaultTheme={appEnv.defaultTheme}
        themes={["dark", "light", "system"]}
        enableSystem
        disableTransitionOnChange
      >
        <I18nProvider>
          <SessionProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </SessionProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
