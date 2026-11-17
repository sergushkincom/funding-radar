"use client"

import * as React from "react"

/**
 * Personal tracking per company: status, follow-up date and one note line.
 * Phase 1 keeps it in this browser (localStorage); phase 2 syncs with Notion.
 */
export type Status = "not_started" | "saved" | "applied" | "intro_sent" | "interviewing" | "rejected" | "offer"

export const STATUSES: { value: Status; label: string; color: string }[] = [
  { value: "not_started", label: "Not started", color: "var(--muted-foreground)" },
  { value: "saved", label: "Saved", color: "var(--color-amber-500)" },
  { value: "applied", label: "Applied", color: "var(--color-sky-500)" },
  { value: "intro_sent", label: "Intro sent", color: "var(--color-violet-500)" },
  { value: "interviewing", label: "Interviewing", color: "var(--color-indigo-500)" },
  { value: "rejected", label: "Rejected", color: "var(--color-rose-500)" },
  { value: "offer", label: "Offer", color: "var(--color-emerald-500)" },
]

export const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s])) as Record<
  Status,
  (typeof STATUSES)[number]
>

export type Entry = { status: Status; followUp?: string; note?: string }
export type Track = Record<string, Entry>

const KEY = "funding-radar:track:v1"
const EMPTY: Track = {}
const listeners = new Set<() => void>()
let cache: Track | null = null

function read(): Track {
  if (cache) return cache
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    cache = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Track) : {}
  } catch {
    cache = {}
  }
  return cache
}

function write(next: Track) {
  cache = next
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage blocked (private mode, quota): keep it for this session only.
  }
  listeners.forEach((l) => l())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return
    cache = null
    onChange()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener("storage", onStorage)
  }
}

export function useTrack() {
  const track = React.useSyncExternalStore(subscribe, read, () => EMPTY)
  const update = React.useCallback((name: string, patch: Partial<Entry>) => {
    const current = read()
    const entry: Entry = { ...(current[name] ?? { status: "not_started" }), ...patch }
    const next = { ...current }
    // An entry with nothing set is dropped, so "Not started" with no date or note leaves no trace.
    if (entry.status === "not_started" && !entry.followUp && !entry.note) delete next[name]
    else next[name] = entry
    write(next)
  }, [])
  return { track, update }
}

/** Local calendar date as YYYY-MM-DD (the date input's format). */
export function isoDay(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Due this week: a follow-up on or before this Sunday, overdue ones included. */
export function isDueThisWeek(followUp: string | undefined, now?: Date) {
  // No follow-up, no clock: also keeps `new Date()` out of the prerendered page (Cache Components).
  if (!followUp) return false
  const today = now ?? new Date()
  const end = new Date(today)
  end.setDate(today.getDate() + ((7 - today.getDay()) % 7))
  return followUp <= isoDay(end)
}
