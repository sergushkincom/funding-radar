import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { ImageResponse } from "next/og"

import { RADAR, ROWS, TODAY, type Group, type Row } from "@/lib/radar"

export const alt = "Funding radar: who just raised, and where the chances are"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// Same hues the chart paints (teal Apply, amber "open with a catch", pink Warm intro).
const GROUP_FILL: Record<Group, string> = {
  apply: "#24a498",
  check: "#fca824",
  warm: "#f850a8",
  watch: "#94a3b8",
}

const ink = "#0a0a0a"
const muted = "#737373"
const line = "#e4e4e4"
const page = "#f7f7f7"

const [inter, interSemi, mono] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Inter-SemiBold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/GeistMono-Regular.ttf")),
])

const fonts = [
  { name: "Inter", data: inter, weight: 400 as const, style: "normal" as const },
  { name: "Inter", data: interSemi, weight: 600 as const, style: "normal" as const },
  { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
]

// The live chart's frame: x is the round date over the last 12 months, y is the chance score.
const START = new Date("2025-11-15T00:00:00Z")
const SPAN = Math.max(1, TODAY.getTime() - START.getTime())
const PLOT = { x0: 46, x1: 640, y0: 28, y1: 518 }

const xOf = (d: Date) =>
  PLOT.x0 + ((Math.max(START.getTime(), d.getTime()) - START.getTime()) / SPAN) * (PLOT.x1 - PLOT.x0)
const yOf = (chance: number) => PLOT.y1 - ((chance - 32) / (94 - 32)) * (PLOT.y1 - PLOT.y0)

type Dot = { row: Row; cx: number; cy: number; r: number; lx: number; ly: number }

function layout(rows: Row[]): Dot[] {
  const dots: Dot[] = rows
    .filter((row) => row.date_iso)
    .map((row) => {
      const d = new Date(row.date_iso!)
      const r = (row.amount_m ? 7 + Math.sqrt(row.amount_m) * 1.45 : 11) * 0.72
      return { row, cx: xOf(d), cy: yOf(row.chance), r, lx: 0, ly: 0 }
    })

  dots.sort((a, b) => b.r - a.r)
  for (let k = 0; k < 50; k++) {
    for (const a of dots) {
      for (const b of dots) {
        if (a === b) continue
        const dx = b.cx - a.cx
        const dy = b.cy - a.cy
        const dist = Math.hypot(dx, dy) || 1
        const min = a.r + b.r + 3
        if (dist < min) {
          const push = ((min - dist) / 2) * 1.15
          b.cy += (dy / dist) * push || push
          a.cy -= (dy / dist) * push || 0
        }
      }
    }
  }
  for (const d of dots) d.cy = Math.min(PLOT.y1 - d.r, Math.max(PLOT.y0 + d.r, d.cy))

  type Box = { x: number; y: number; w: number; h: number }
  const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const boxes: Box[] = dots.map((d) => ({ x: d.cx - d.r, y: d.cy - d.r, w: d.r * 2, h: d.r * 2 }))
  const near = [0, -14, 14, -28, 28]
  for (const d of dots.slice().sort((a, b) => a.cx - b.cx)) {
    const w = d.row.name.length * 6.6 + 4
    const rightX = d.cx + d.r + 8
    const leftX = d.cx - d.r - 8 - w
    const slots = near.flatMap((dy) => [{ x: rightX, dy }, { x: leftX, dy }])
    const free =
      slots.find((sl) => {
        if (sl.x < 8 || sl.x + w > PLOT.x1 + 28) return false
        const bx = { x: sl.x, y: d.cy + sl.dy - 8, w, h: 15 }
        return !boxes.some((b) => hit(b, bx))
      }) ?? { x: rightX, dy: 0 }
    boxes.push({ x: free.x, y: d.cy + free.dy - 8, w, h: 15 })
    d.lx = free.x
    d.ly = d.cy + free.dy
  }
  return dots
}

const dots = layout(RADAR)
const companies = RADAR.length
const designRoles = ROWS.reduce((sum, row) => sum + (row.designRoles ?? 0), 0)
const highChance = ROWS.filter((row) => row.chance >= 70).length

function Kpi({ value, label }: { value: number; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: 128,
        border: `1px solid ${line}`,
        borderRadius: 14,
        background: "#fff",
        padding: "12px 14px 13px",
      }}
    >
      <div style={{ display: "flex", fontSize: 30, fontWeight: 600, letterSpacing: -0.6, lineHeight: 1 }}>
        {String(value)}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.25, color: muted }}>{label}</div>
    </div>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 9, height: 9, borderRadius: 9, background: color }} />
      <div style={{ fontSize: 13, color: muted }}>{label}</div>
    </div>
  )
}

export default function OpenGraphImage() {
  const y70 = yOf(70)
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: page,
          color: ink,
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            width: 488,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "46px 22px 36px 44px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontFamily: "Geist Mono",
                fontSize: 13,
                letterSpacing: 2.4,
                color: muted,
              }}
            >
              FUNDING RADAR
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 18,
                fontSize: 48,
                fontWeight: 600,
                letterSpacing: -1.3,
                lineHeight: 1.02,
              }}
            >
              <div>Who just raised,</div>
              <div>and my chances</div>
            </div>
            <div style={{ marginTop: 16, fontSize: 20, lineHeight: 1.35, color: muted, maxWidth: 380 }}>
              Munich-area rounds. Further right is newer. Higher is a better chance.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Kpi value={companies} label="companies on the radar" />
              <Kpi value={designRoles} label="open design roles" />
              <Kpi value={highChance} label="chance 70+" />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <Swatch color={GROUP_FILL.apply} label="Apply" />
              <Swatch color={GROUP_FILL.check} label="Open, with a catch" />
              <Swatch color={GROUP_FILL.warm} label="Warm intro" />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            position: "relative",
            margin: "24px 24px 24px 0",
            flex: 1,
            background: "#fff",
            border: `1px solid ${line}`,
            borderRadius: 18,
          }}
        >
          {[50, 70, 90].map((v) => (
            <div
              key={v}
              style={{
                position: "absolute",
                left: PLOT.x0,
                top: yOf(v),
                width: PLOT.x1 - PLOT.x0,
                height: 1,
                background: v === 70 ? "transparent" : "#efefef",
                borderTop: v === 70 ? "1px dashed #bdbdbd" : "none",
                display: "flex",
              }}
            />
          ))}
          {[50, 70, 90].map((v) => (
            <div
              key={`t${v}`}
              style={{
                position: "absolute",
                left: 10,
                top: yOf(v) - 7,
                fontFamily: "Geist Mono",
                fontSize: 11,
                color: muted,
                display: "flex",
              }}
            >
              {String(v)}
            </div>
          ))}
          <div
            style={{
              position: "absolute",
              right: 16,
              top: y70 - 18,
              fontFamily: "Geist Mono",
              fontSize: 11,
              color: ink,
              display: "flex",
            }}
          >
            chance 70+
          </div>
          <div
            style={{
              position: "absolute",
              left: PLOT.x0,
              top: 12,
              fontFamily: "Geist Mono",
              fontSize: 11,
              color: muted,
              display: "flex",
            }}
          >
            chance ↑
          </div>
          <div
            style={{
              position: "absolute",
              right: 16,
              bottom: 14,
              fontFamily: "Geist Mono",
              fontSize: 11,
              color: muted,
              display: "flex",
            }}
          >
            round date →
          </div>

          {dots.map((d) => {
            const color = GROUP_FILL[d.row.group]
            const count = d.row.designRoles
            return (
              <div key={d.row.name} style={{ display: "flex", position: "absolute", left: 0, top: 0 }}>
                <div
                  style={{
                    position: "absolute",
                    left: d.cx - d.r,
                    top: d.cy - d.r,
                    width: d.r * 2,
                    height: d.r * 2,
                    borderRadius: d.r,
                    background: d.row.amount_m ? color : "#fff",
                    border: d.row.date_approx ? `2px dashed ${color}` : `2px solid ${color}`,
                    display: "flex",
                  }}
                />
                {d.row.group !== "warm" && (
                  <div
                    style={{
                      position: "absolute",
                      left: d.cx + d.r * 0.62 - 8,
                      top: d.cy - d.r * 0.62 - 8,
                      width: 16,
                      height: 16,
                      borderRadius: 16,
                      background: "#fff",
                      border: `1.5px solid ${color}`,
                      color: ink,
                      fontFamily: "Geist Mono",
                      fontSize: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {count == null ? "?" : String(count)}
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    left: d.lx,
                    top: d.ly - 8,
                    fontSize: 12,
                    color: ink,
                    display: "flex",
                  }}
                >
                  {d.row.name}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
