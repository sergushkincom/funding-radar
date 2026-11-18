"use client"

import * as React from "react"

import type { TrackedRow } from "@/components/radar/filters"
import { GROUP_COLOR, TODAY, amountShort, fmtDate } from "@/lib/radar"
import { STATUS_ICON } from "@/components/radar/status-select"
import { FAMILY_VIEWS, type FamilyView } from "@/lib/feed"
import { NEW_LABEL } from "@/lib/seen"
import { STATUS_BY_VALUE } from "@/lib/track"
import { cn } from "@/lib/utils"

// Ported from the prototype's SVG: x = round date over 12 months, y = chance, r = round amount.
// Hand-drawn rather than Recharts so the label placement (no overlaps, leader lines) carries over 1:1.
const W = 1000
const H = 600
const X0 = 60
const X1 = 930
const Y0 = 24
const Y1 = 548
const START = new Date("2025-11-15")
const SPAN = TODAY.getTime() - START.getTime()
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

const x = (d: Date) => X0 + ((Math.max(START.getTime(), d.getTime()) - START.getTime()) / SPAN) * (X1 - X0)
const y = (v: number) => Y1 - ((v - 32) / (94 - 32)) * (Y1 - Y0)

type Point = {
  row: TrackedRow
  cx: number
  cy: number
  r: number
  old: boolean
  lx: number
  ly: number
  text: string
  /** Label on the left of the bubble. */
  left: boolean
}

type Box = { x: number; y: number; w: number; h: number }
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function layout(rows: TrackedRow[]): Point[] {
  const pts: Point[] = rows.map((row) => {
    const d = row.date_iso ? new Date(row.date_iso) : null
    return {
      row,
      cx: d ? (d < START ? X0 : x(d)) : X0,
      cy: y(row.chance),
      r: row.amount_m ? 7 + Math.sqrt(row.amount_m) * 1.45 : 11,
      old: !!d && d < START,
      lx: 0,
      ly: 0,
      text: "",
      left: false,
    }
  })
  // Nudge overlapping bubbles apart.
  pts.sort((a, b) => b.r - a.r)
  for (let k = 0; k < 60; k++)
    for (const a of pts)
      for (const b of pts) {
        if (a === b) continue
        const dx = b.cx - a.cx
        const dy = b.cy - a.cy
        const dist = Math.hypot(dx, dy) || 1
        const min = a.r + b.r + 4
        if (dist < min) {
          const p = (min - dist) / 2
          b.cy += (dy / dist) * p * 1.2 || p
          a.cy -= (dy / dist) * p * 1.2 || 0
        }
      }
  // Labels: first free slot beside the bubble, right side first, then left; a leader line when moved.
  // Short offsets on both sides come before long ones, so a leader stays under ~40px where it can.
  const boxes: Box[] = pts.map((p) => ({ x: p.cx - p.r, y: p.cy - p.r, w: p.r * 2, h: p.r * 2 }))
  const near = [0, -16, 16, -30, 30]
  const far = [-44, 44, -58, 58, -72, 72]
  for (const p of pts.slice().sort((a, b) => a.cx - b.cx)) {
    const c = p.row
    const text = c.name + (p.old ? " ← " + fmtDate(c) : "")
    const w = text.length * 6.9 + 4
    const rightX = p.cx + p.r + (c.group !== "warm" ? 14 : 6)
    const leftX = p.cx - p.r - 6 - w
    const slots = [
      ...near.flatMap((dy) => [
        { x: rightX, dy, left: false },
        { x: leftX, dy, left: true },
      ]),
      ...far.flatMap((dy) => [
        { x: rightX, dy, left: false },
        { x: leftX, dy, left: true },
      ]),
    ].filter((sl) => sl.x >= 4 && sl.x + w <= W - 4)
    const free = slots.find((sl) => {
      const bx = { x: sl.x, y: p.cy + sl.dy - 9, w, h: 16 }
      return !boxes.some((b) => hit(b, bx))
    }) ?? { x: rightX, dy: 0, left: false }
    boxes.push({ x: free.x, y: p.cy + free.dy - 9, w, h: 16 })
    p.lx = free.x
    p.ly = p.cy + free.dy
    p.left = free.left
    p.text = text
  }
  return pts
}

export function RadarChart({
  rows,
  selected,
  onSelect,
  family = "designer",
}: {
  /** The radar companies that pass the current filters and search. */
  rows: TrackedRow[]
  selected: string | null
  onSelect: (name: string) => void
  /** Which role family the number on each bubble counts. y stays the (design) chance in every view. */
  family?: FamilyView
}) {
  const designView = family === "designer"
  const famLabel = FAMILY_VIEWS.find((f) => f.value === family)!.kpi.replace("open ", "")
  // Re-lay out only when the set of companies changes, not on every status edit.
  const key = rows.map((r) => r.name).join("|")
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the names; statuses are read at render
  const laid = React.useMemo(() => layout(rows), [key])
  const byName = new Map(rows.map((r) => [r.name, r]))
  const points = laid.map((p) => ({ ...p, row: byName.get(p.row.name) ?? p.row }))
  const [hovered, setHovered] = React.useState<string | null>(null)
  const hoverPoint = points.find((p) => p.row.name === hovered)
  const ticks = React.useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const d = new Date(2025, 10 + i + 1, 1)
        return { x: x(d), label: MONTHS[d.getMonth()] + (d.getMonth() === 0 ? " ’26" : "") }
      }),
    [],
  )

  // On narrow screens the chart scrolls sideways: start at the right end, where the newest rounds are.
  const scroller = React.useRef<HTMLDivElement>(null)
  const [atEnd, setAtEnd] = React.useState(true)
  const [scrollable, setScrollable] = React.useState(false)
  React.useEffect(() => {
    const el = scroller.current
    if (!el) return
    const update = () => {
      setScrollable(el.scrollWidth > el.clientWidth + 1)
      setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2)
    }
    el.scrollLeft = el.scrollWidth
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div ref={scroller} className="-mx-2 overflow-x-auto px-2 pb-1">
          <div className="relative min-w-[720px]">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="block h-auto w-full overflow-visible text-muted-foreground"
              role="img"
              aria-label="Companies by round date (x) and chance (y). Select a bubble to see details."
            >
              {[40, 50, 60, 70, 80, 90].map((v) => (
                <g key={v}>
                  <line
                    x1={X0}
                    x2={X1 + 50}
                    y1={y(v)}
                    y2={y(v)}
                    className={v === 70 ? "stroke-foreground/30" : "stroke-border"}
                    strokeDasharray={v === 70 ? "4 4" : undefined}
                  />
                  <text
                    x={X0 - 10}
                    y={y(v) + 4}
                    textAnchor="end"
                    className="fill-muted-foreground font-mono text-[11px]"
                  >
                    {v}
                  </text>
                </g>
              ))}
              <text
                x={X1 + 48}
                y={y(70) - 6}
                textAnchor="end"
                className={cn("font-mono text-[11px]", designView ? "fill-foreground" : "fill-muted-foreground/60")}
              >
                chance 70+
              </text>
              {ticks.map((t) => (
                <g key={t.label}>
                  <text x={t.x} y={Y1 + 28} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">
                    {t.label}
                  </text>
                  <line x1={t.x} x2={t.x} y1={Y1} y2={Y1 + 8} className="stroke-border" />
                </g>
              ))}
              <line x1={X0} x2={X1 + 50} y1={Y1} y2={Y1} className="stroke-border" />
              <text x={X1 + 50} y={Y1 + 46} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
                round date →
              </text>
              <text
                x={X0 - 44}
                y={Y0 - 8}
                className={cn(
                  "font-mono text-[11px]",
                  designView ? "fill-muted-foreground" : "fill-muted-foreground/60",
                )}
              >
                {designView ? "chance ↑ (points of 100)" : "chance ↑ (design profile only)"}
              </text>

              {points.map((p) => {
                const c = p.row
                const col = GROUP_COLOR[c.group]
                const isSel = selected === c.name
                const moved = Math.abs(p.ly - p.cy) > 1
                return (
                  <g
                    key={c.name}
                    role="button"
                    tabIndex={0}
                    aria-label={`${c.name}, chance ${c.chance}`}
                    aria-pressed={isSel}
                    onClick={() => onSelect(c.name)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onSelect(c.name)
                      }
                    }}
                    onPointerEnter={() => setHovered(c.name)}
                    onPointerLeave={() => setHovered((h) => (h === c.name ? null : h))}
                    onFocus={() => setHovered(c.name)}
                    onBlur={() => setHovered((h) => (h === c.name ? null : h))}
                    className="group/bubble cursor-pointer outline-none"
                  >
                    {c.status !== "not_started" && (
                      <circle cx={p.cx} cy={p.cy} r={p.r + 4} fill="none" strokeWidth={2} className="stroke-foreground">
                        <title>{STATUS_BY_VALUE[c.status].label}</title>
                      </circle>
                    )}
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={p.r + 7}
                      fill="none"
                      stroke={col}
                      strokeOpacity={0.5}
                      strokeWidth={2}
                      className={cn(
                        "opacity-0 transition-opacity group-focus-visible/bubble:opacity-100",
                        isSel && "opacity-100",
                      )}
                    />
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={p.r}
                      fill={c.amount_m ? col : "var(--background)"}
                      fillOpacity={c.amount_m ? 0.85 : 1}
                      stroke={col}
                      strokeWidth={2}
                      strokeDasharray={c.date_approx ? "3 3" : undefined}
                      className="origin-center transition-[transform,filter] duration-200 [transform-box:fill-box] group-hover/bubble:-translate-y-0.5 group-hover/bubble:scale-[1.08] group-hover/bubble:drop-shadow-[0_4px_6px_rgb(0_0_0/0.25)]"
                    />
                    {c.group !== "warm" && (
                      <g>
                        <circle
                          cx={p.cx + p.r * 0.72}
                          cy={p.cy - p.r * 0.72}
                          r={9}
                          fill="var(--background)"
                          stroke={col}
                          strokeWidth={1.5}
                        />
                        <text
                          x={p.cx + p.r * 0.72}
                          y={p.cy - p.r * 0.72 + 4}
                          textAnchor="middle"
                          className="fill-foreground font-mono text-[10px]"
                        >
                          {c.familyCount ?? "?"}
                        </text>
                      </g>
                    )}
                    {c.isNew.length > 0 && (
                      <circle
                        cx={p.cx - p.r * 0.72}
                        cy={p.cy - p.r * 0.72}
                        r={4.5}
                        className="fill-sky-500 stroke-background"
                        strokeWidth={1.5}
                      >
                        <title>{"New: " + c.isNew.map((r) => NEW_LABEL[r]).join(", ")}</title>
                      </circle>
                    )}
                    {STATUS_ICON[c.status] &&
                      (() => {
                        // Which status: an icon badge at the bottom-left, so the ring colour never competes with the group.
                        const Icon = STATUS_ICON[c.status]!
                        const bx = p.cx - p.r * 0.72
                        const by = p.cy + p.r * 0.72
                        return (
                          <g aria-hidden>
                            <circle cx={bx} cy={by} r={8.5} className="fill-foreground" />
                            <Icon
                              x={bx - 5.5}
                              y={by - 5.5}
                              width={11}
                              height={11}
                              strokeWidth={2.5}
                              className="text-background"
                            />
                          </g>
                        )
                      })()}
                    {moved && (
                      <line
                        x1={p.left ? p.cx - p.r * 0.7 : p.cx + p.r * 0.7}
                        y1={p.cy}
                        x2={p.left ? p.lx + p.text.length * 6.9 + 6 : p.lx - 3}
                        y2={p.ly}
                        stroke={col}
                        strokeOpacity={0.45}
                      />
                    )}
                    <text
                      x={p.lx}
                      y={p.ly + 4}
                      className={cn("pointer-events-none fill-foreground text-xs", isSel && "font-semibold")}
                    >
                      {p.text}
                    </text>
                  </g>
                )
              })}
            </svg>
            {rows.length === 0 && (
              <p className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
                No radar companies match the filters.
              </p>
            )}
            {hoverPoint && (
              <div
                role="tooltip"
                className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                style={{
                  left: `${(hoverPoint.cx / W) * 100}%`,
                  top: `calc(${((hoverPoint.cy - hoverPoint.r) / H) * 100}% - 8px)`,
                }}
              >
                <p className="font-medium">{hoverPoint.row.name}</p>
                <p className="text-muted-foreground">
                  {designView ? `Chance ${hoverPoint.row.chance} · ` : ""}
                  {amountShort(hoverPoint.row)}
                </p>
                <p className="text-muted-foreground">
                  {hoverPoint.row.familyCount === null
                    ? `${famLabel[0].toUpperCase()}${famLabel.slice(1)} [TBC]`
                    : `${hoverPoint.row.familyCount} ${famLabel}`}
                  {hoverPoint.row.status !== "not_started" && ` · ${STATUS_BY_VALUE[hoverPoint.row.status].label}`}
                </p>
              </div>
            )}
          </div>
        </div>
        {scrollable && (
          <>
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 w-10 bg-linear-to-r from-card to-transparent transition-opacity",
                atEnd ? "opacity-100" : "opacity-0",
              )}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 w-10 bg-linear-to-l from-card to-transparent transition-opacity",
                atEnd ? "opacity-0" : "opacity-100",
              )}
            />
          </>
        )}
      </div>
      {scrollable && (
        <p className="text-xs text-muted-foreground">
          {atEnd ? "← Scroll for older rounds" : "Scroll → for recent rounds"}
        </p>
      )}
    </div>
  )
}
