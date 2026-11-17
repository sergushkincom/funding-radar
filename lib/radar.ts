// Ported 1:1 from the prototype (drafts/funding-radar/d-radar.html + common.js in claude-agents).
// Chance is a transparent rule-based estimate, not a forecast.
import companiesJson from "@/data/companies.json"
import jobsJson from "@/data/jobs.json"
import { FEED, liveRoles } from "@/lib/feed"

export type Company = {
  name: string
  city: string
  round: string
  date: string
  amount: string
  valuation: string
  team: string
  role: string
  role_url: string
  workplace: string
  posted: string
  fit: string
  tier: number
  what: string
  why: string
  src: string
  amount_m: number | null
  date_iso: string | null
  date_approx: boolean
  /** What research found about the design team; drives the score's team factor. */
  design_team?: "head_of_design" | "first_designer" | "no_designer" | null
}

export type Job = { title: string; url: string; loc: string }
export type JobsEntry = { total: number; design: Job[]; source: string; checked: string }

export const COMPANIES = companiesJson as Company[]
/**
 * Open roles: the curated 15.11 list, replaced per company by the daily snapshot wherever that fetch worked.
 * The chance score, KPIs and filters all read from here, so they follow the live roles.
 */
export const JOBS: Record<string, JobsEntry> = (() => {
  const out = { ...(jobsJson as Record<string, JobsEntry>) }
  for (const name of Object.keys(FEED.companies)) {
    const live = liveRoles(name)
    if (!live) continue
    out[name] = {
      total: live.total ?? 0,
      design: live.design.map((d) => ({ title: d.title, url: d.url, loc: d.loc })),
      source: live.source === "personio" ? "Personio XML" : "Ashby API",
      checked: live.checked ?? "",
    }
  }
  return out
})()

/** "Months ago" counts from the latest snapshot day, so it moves with the daily refresh (no clock read at render). */
export const TODAY = new Date(`${FEED.generated}T00:00:00Z`)
/** When the rounds themselves were researched. */
export const DATA_DATE = "15.11.2026"

export type Group = "apply" | "check" | "warm" | "watch"

export const LABEL: Record<Group, string> = {
  apply: "Apply",
  check: "Role open, with a catch",
  warm: "Warm intro",
  watch: "Background",
}

/** Group colours as CSS variables (see globals.css), so light and dark each get a readable tone. */
export const GROUP_COLOR: Record<Group, string> = {
  apply: "var(--group-apply)",
  check: "var(--group-check)",
  warm: "var(--group-warm)",
  watch: "var(--group-watch)",
}

export function group(c: Company): Group {
  if (c.role && c.fit === "A") return "apply"
  if (c.role) return "check"
  if (c.fit === "B-warm") return "warm"
  return "watch"
}

export function monthsAgo(c: Company): number | null {
  if (!c.date_iso) return null
  const d = new Date(c.date_iso)
  return Math.max(0, Math.round((TODAY.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 30.44)))
}

export function ago(c: Company): string {
  const m = monthsAgo(c)
  if (m === null) return "date [TBC]"
  const pre = c.date_approx ? "~" : ""
  if (m === 0) return pre + "this month"
  return pre + m + " mo ago"
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export function fmtDate(c: Company): string {
  if (!c.date) return "[TBC]"
  const m = c.date.match(/(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!m) return c.date
  const mon = MONTHS[+m[2] - 1]
  return (c.date_approx ? "~" : "") + (m[3] && !c.date_approx ? +m[3] + " " : "") + mon + " " + m[1]
}

export function amountShort(c: Company): string {
  if (/undisclosed/.test(c.amount)) return "amount undisclosed"
  return c.amount
}

export function roles(c: Company): Job[] {
  const j = JOBS[c.name]
  if (j) return j.design
  return c.role ? [{ title: c.role, url: c.role_url, loc: c.workplace }] : []
}

function roleLevel(t: string): number {
  if (/principal|staff/i.test(t)) return 35
  if (/design manager/i.test(t)) return 22
  if (/senior|sr\.|design engineer/i.test(t)) return 25
  return 15
}

export type Factor = { label: string; value: number; max: number; why: string }
export type Score = { total: number; factors: Factor[]; why: string[] }

export function score(c: Company): Score {
  const f: Factor[] = []
  const m = monthsAgo(c)
  const fresh = m === null ? 0 : m <= 3 ? 20 : m <= 6 ? 15 : m <= 9 ? 10 : m <= 12 ? 5 : 0
  f.push({
    label: "Round freshness",
    value: fresh,
    max: 20,
    why: m === null ? "round date [TBC]" : m > 12 ? "round older than 12 months" : "raised " + ago(c),
  })

  const rs = roles(c)
  let role = rs.length ? Math.max(...rs.map((r) => roleLevel(r.title))) : 5
  const best = rs.slice().sort((a, b) => roleLevel(b.title) - roleLevel(a.title))[0]
  let roleWhy = best
    ? roleLevel(best.title) >= 35
      ? "Staff/Principal role open"
      : roleLevel(best.title) >= 25
        ? "Senior role open"
        : "role below Principal"
    : "no open role, warm intro only"
  if (c.posted && !c.posted.includes("TBC") && (TODAY.getTime() - new Date(c.posted).getTime()) / 864e5 > 270) {
    role -= 10
    roleWhy += ", but open for almost a year"
  }
  f.push({ label: "Design role", value: Math.max(0, role), max: 35, why: roleWhy })

  const topicTable: Record<string, number> = { A: 25, B: 18, "B-warm": 18, "A-low": 8, C: 5 }
  const topic = topicTable[c.fit] ?? 5
  f.push({
    label: "Topic (B2B/ERP, agents)",
    value: topic,
    max: 25,
    why: topic >= 25 ? "topic matches the profile" : topic >= 18 ? "related topic" : "topic far from the profile",
  })

  const loc = c.city + " " + (c.workplace || "") + " " + (best?.loc || "")
  const geo = /stockholm/i.test(loc)
    ? 0
    : /münchen|munich|remote|germany/i.test(loc)
      ? 10
      : /stuttgart/i.test(loc)
        ? 3
        : 5
  f.push({
    label: "Munich / remote DE",
    value: geo,
    max: 10,
    why: geo === 10 ? "Munich or remote from Germany" : geo === 0 ? "needs relocation" : "another city",
  })

  let team = 5
  let tw = "team or design lead [TBC]"
  if (c.design_team === "head_of_design") {
    team = 0
    tw = "already has a Head of Design"
  } else if (c.design_team === "first_designer") {
    team = 10
    tw = "chance to be the first designer"
  } else if (c.design_team === "no_designer") {
    team = 8
    tw = "no designer on the team, it seems"
  } else if (/8 product designers/.test(c.team)) {
    team = 6
    tw = "8 designers: room to grow to Staff"
  }
  f.push({ label: "Team / design lead", value: team, max: 10, why: tw })

  const total = f.reduce((a, x) => a + x.value, 0)
  const pos = f
    .filter((x) => x.value / x.max >= 0.7)
    .sort((a, b) => b.value / b.max - a.value / a.max)
    .map((x) => x.why)
  const neg = f.filter((x) => x.value / x.max < 0.4).map((x) => x.why)
  const why = [pos.slice(0, 2).join("; "), neg.length ? "minus: " + neg.slice(0, 2).join("; ") : ""].filter(Boolean)
  return { total, factors: f, why }
}

export function investors(round: string): string {
  const m = round.match(/\((.*)\)/)
  return m ? m[1].replace(/^lead\s*/i, "lead ") : "[TBC]"
}

export function roundType(round: string): string {
  return round.replace(/\s*\(.*\)/, "")
}

export function nextStep(g: Group): { title: string; detail: string } {
  if (g === "apply") return { title: "Apply", detail: "Apply via the posting" }
  if (g === "check") return { title: "Check, then apply", detail: "Check the level / city first, then apply" }
  if (g === "warm")
    return { title: "Write a warm intro", detail: "To the founder or CPO: short, with one relevant case" }
  return { title: "Watch", detail: "Don't write yet" }
}

/** Munich (or remote from Germany) vs. elsewhere, for the location filter. Same rule as the score. */
export type Place = "munich" | "remote" | "elsewhere"

export function place(c: Company): Place {
  const loc = c.city + " " + (c.workplace || "")
  if (/münchen|munich/i.test(loc)) return "munich"
  if (/remote/i.test(loc)) return "remote"
  return "elsewhere"
}

/** Best open design role, by the same levels the score uses. "none" = no open role. */
export type RoleLevel = "staff" | "senior" | "other" | "none"

export function roleLevelOf(c: Company): RoleLevel {
  const rs = roles(c)
  if (!rs.length) return "none"
  const top = Math.max(...rs.map((r) => roleLevel(r.title)))
  return top >= 35 ? "staff" : top >= 25 ? "senior" : "other"
}

/** From the research's workplace field only; nothing is inferred from job locations. */
export type Workplace = "remote" | "hybrid" | "onsite" | "tbc"

export function workplaceOf(c: Company): Workplace {
  if (/remote/i.test(c.workplace)) return "remote"
  if (/hybrid/i.test(c.workplace)) return "hybrid"
  if (/on-?site/i.test(c.workplace)) return "onsite"
  return "tbc"
}

/**
 * Round stage from the round text. "Growth" counts as C+ (a late round without a series letter);
 * a strategic investment or a public loan (EIB) is "strategic"; no round text is [TBC].
 */
export type Stage = "seed" | "a" | "b" | "cplus" | "strategic" | "tbc"

export function stageOf(c: Company): Stage {
  const r = c.round
  if (/strategic|eib/i.test(r)) return "strategic"
  if (/series\s*[c-z]\b|growth/i.test(r)) return "cplus"
  if (/series\s*b\b/i.test(r)) return "b"
  if (/series\s*a\b/i.test(r)) return "a"
  if (/seed/i.test(r)) return "seed"
  return "tbc"
}

export type Row = Company & {
  id: string
  group: Group
  score: Score
  chance: number
  designRoles: number | null
  hasDesignRole: boolean
  place: Place
  months: number | null
  roleLevel: RoleLevel
  workplaceKind: Workplace
  stage: Stage
}

export const ROWS: Row[] = COMPANIES.map((c) => {
  const g = group(c)
  const s = score(c)
  const known = JOBS[c.name]
  return {
    ...c,
    id: c.name,
    group: g,
    score: s,
    chance: s.total,
    // Count only where the ATS was read; otherwise unknown ([TBC]), even if the research names one role.
    designRoles: known ? known.design.length : null,
    hasDesignRole: roles(c).length > 0,
    place: place(c),
    months: monthsAgo(c),
    roleLevel: roleLevelOf(c),
    workplaceKind: workplaceOf(c),
    stage: stageOf(c),
  }
})

export const RADAR = ROWS.filter((r) => r.group !== "watch")
export const BACKGROUND = ROWS.filter((r) => r.group === "watch")
