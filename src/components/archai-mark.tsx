/**
 * ArchaiMark — علامة أركاي الموحدة: قوس نيون + نقطة نحاس.
 * من هووية الشعار (دايرة + مسار نحاس) — تُستخدم في الدخول والأغلفة.
 */

import { cn } from "@/lib/utils"

const SIZES = {
  sm: { box: "size-8", svg: "size-5" },
  lg: { box: "size-11", svg: "size-7" },
} as const

export function ArchaiMark({
  size = "sm",
  className,
}: {
  size?: keyof typeof SIZES
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-ink text-arc shadow-[inset_0_0_0_1px_rgba(150,165,180,0.18)]",
        SIZES[size].box,
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className={SIZES[size].svg} fill="none" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="7"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="33 11"
          transform="rotate(-45 12 12)"
        />
        <circle cx="12" cy="12" r="2" fill="#C48A5C" />
      </svg>
    </span>
  )
}
