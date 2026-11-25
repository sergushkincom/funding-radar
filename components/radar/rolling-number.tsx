"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * The chart's "N on the radar" figure. Each digit is a wheel that turns to the new
 * value; a new place grows in from the left. Motion lives in globals.css and is
 * omitted when the user prefers reduced motion, so the number just changes.
 */
export function RadarCount({ value }: { value: number }) {
  const digits = String(value).split("").map((d) => Number(d))
  // Hold the previous width until the new place has grown in, so the class stays on for the animation.
  const [shownLen, setShownLen] = React.useState(digits.length)
  const grew = digits.length > shownLen
  React.useEffect(() => {
    if (digits.length === shownLen) return
    const grow = digits.length > shownLen && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const id = window.setTimeout(() => setShownLen(digits.length), grow ? 280 : 0)
    return () => window.clearTimeout(id)
  }, [digits.length, shownLen])

  return (
    <span className="inline-flex items-center gap-[0.35em] leading-none tabular-nums" aria-live="polite">
      <span className="sr-only">
        {value} on the radar
      </span>
      <span aria-hidden className="inline-flex">
        {digits.map((digit, i) => (
          <span key={digits.length - i} className={cn("digit-col", grew && i === 0 && "digit-col-in")}>
            <span className="digit-strip" style={{ transform: `translateY(${-digit}em)` }}>
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        ))}
      </span>
      <span aria-hidden>on the radar</span>
    </span>
  )
}
