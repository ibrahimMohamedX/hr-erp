/**
 * ScrollToTop — إرجاع التمرير لأعلى عند كل تنقل (سلوك SPA قياسي واحترافي).
 * instant بدل smooth: تغيير الصفحة نفسه هو الحركة.
 */

import { useEffect } from "react"
import { useLocation } from "react-router"

export function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [pathname])

  return null
}
