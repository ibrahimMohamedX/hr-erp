/**
 * Archai HR — HR ERP SaaS متعدد الشركات.
 * نقطة تركيب التطبيق: Providers ← Router.
 * التفاصيل الكاملة: docs/01-architecture.md
 */

import { AppRouter } from "@/app/router"
import { Providers } from "@/app/providers"

export default function App() {
  return (
    <Providers>
      <AppRouter />
    </Providers>
  )
}
