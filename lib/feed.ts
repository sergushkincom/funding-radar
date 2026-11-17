// The daily snapshot from scripts/refresh.mjs (GitHub Actions): open roles and company news.
import feedJson from "@/data/feed.json"
import sourcesJson from "@/data/sources.json"

export type FeedRole = { title: string; url: string; loc: string; published: string | null }
export type FamilyCounts = { design: number; engineering: number; product: number; data: number; other: number }
export type FeedRoles = {
  total: number | null
  design: FeedRole[]
  families?: { engineering: FeedRole[]; product: FeedRole[]; data: FeedRole[] }
  counts?: FamilyCounts
  source?: string
  checked: string | null
  history: { date: string; total: number; design: number; counts?: FamilyCounts }[]
  error?: string
}
export type NewsTag = "funding" | "launch" | "hire" | "other"
export type NewsItem = { title: string; url: string; source: string; sourceUrl: string; date: string; tag: NewsTag }
export type FeedEntry = { roles?: FeedRoles; news?: NewsItem[] | null; newsChecked?: string | null; newsError?: string }

export const FEED = feedJson as unknown as { generated: string; companies: Record<string, FeedEntry> }

type Source = {
  site: string | null
  careers: { type: string; slug: string; url: string } | null
  linkedin: string | null
  news: { name: string; require: string[] } | null
}
export const SOURCES = (sourcesJson as unknown as { companies: Record<string, Source> }).companies

/** Roles from the latest snapshot, only when that fetch worked. */
export function liveRoles(name: string): FeedRoles | null {
  const r = FEED.companies[name]?.roles
  return r && !r.error && r.total !== null ? r : null
}

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()

export type HiringSignal = {
  /** Roles in the selected family first published in the 30 days before the snapshot (ATS publish dates). */
  new30: number
  /** The newest publish date among those roles, to say when the current role went up. */
  newestPublished: string | null
  /** Total open roles now vs. the oldest snapshot within the last 7–30 days (null until there is one). */
  trend: { from: number; to: number; since: string } | null
  /** First snapshot day: "tracking since". */
  since: string
  checked: string
}

export function hiringSignal(name: string, family: FamilyView): HiringSignal | null {
  const r = liveRoles(name)
  if (!r || !r.checked) return null
  const now = day(r.checked)
  const list = familyList(r, family) ?? []
  const dated = list.map((d) => d.published).filter((d): d is string => !!d)
  const new30 = dated.filter((d) => now - day(d) <= 30 * 864e5).length
  // A week back at least, so one day's noise doesn't read as a trend.
  const base = r.history.find((h) => {
    const age = now - day(h.date)
    return age >= 7 * 864e5 && age <= 30 * 864e5
  })
  return {
    new30,
    newestPublished: dated.sort().at(-1) ?? null,
    trend: base && r.total !== null ? { from: base.total, to: r.total, since: base.date } : null,
    since: r.history[0]?.date ?? r.checked,
    checked: r.checked,
  }
}

/* ------------------------------ role families ------------------------------ */

/** The switch at the top: which roles the counts, bubbles and lists are about. */
export type FamilyView = "designer" | "developer" | "pm" | "all"

export const FAMILY_VIEWS: { value: FamilyView; label: string; kpi: string; column: string }[] = [
  { value: "designer", label: "Designer", kpi: "open design roles", column: "Design roles" },
  { value: "developer", label: "Developer", kpi: "open engineering roles", column: "Dev roles" },
  { value: "pm", label: "PM", kpi: "open product roles", column: "PM roles" },
  { value: "all", label: "All", kpi: "open roles, all families", column: "All roles" },
]

/** Developer = engineering + data/ML. All = every role; only the four families are kept as lists. */
function familyList(r: FeedRoles, family: FamilyView): FeedRole[] | null {
  if (family === "designer") return r.design
  if (!r.families) return null
  if (family === "developer") return [...r.families.engineering, ...r.families.data]
  if (family === "pm") return r.families.product
  return [...r.design, ...r.families.engineering, ...r.families.product, ...r.families.data]
}

/**
 * Open roles of one family at one company: a count and the list behind it, or null = [TBC]
 * (no careers feed, or the refresh hasn't filled that family yet).
 */
export function familyRoles(
  name: string,
  family: FamilyView,
  curated?: { total: number; design: { title: string; url: string; loc: string }[] },
): { count: number; list: { title: string; url: string; loc: string }[]; more: number } | null {
  const r = liveRoles(name)
  if (r) {
    const list = familyList(r, family)
    if (list) {
      const count = family === "all" ? (r.total ?? list.length) : list.length
      return { count, list, more: count - list.length }
    }
  }
  // Static data (15.11) only has design titles; for "all" it also has the total.
  if (!curated) return null
  if (family === "designer") return { count: curated.design.length, list: curated.design, more: 0 }
  if (family === "all")
    return { count: curated.total, list: curated.design, more: curated.total - curated.design.length }
  return null
}

export function fmtDay(iso: string | null | undefined) {
  if (!iso) return "[TBC]"
  const [y, m, d] = iso.split("-")
  return `${d}.${m}.${y}`
}
