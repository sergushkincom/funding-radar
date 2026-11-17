"use client"

import * as React from "react"

import { FEED, liveRoles } from "@/lib/feed"
import type { Row } from "@/lib/radar"

const KEY = "funding-radar:last-visit:v1"
let previous: string | null | undefined

/**
 * The day of the previous visit (YYYY-MM-DD), read once per page load; this visit is stored for next time.
 * A first visit has no previous one, so nothing is marked new: there is no "since" yet.
 */
function readPrevious(): string | null {
  if (previous !== undefined) return previous
  try {
    previous = window.localStorage.getItem(KEY)
    window.localStorage.setItem(KEY, new Date().toISOString().slice(0, 10))
  } catch {
    previous = null
  }
  return previous
}

const noop = () => () => {}

export function usePreviousVisit() {
  return React.useSyncExternalStore(noop, readPrevious, () => null)
}

export type NewReason = "round" | "role" | "hire"

/** What appeared after the previous visit: a round, a design role, or a hire-type news item. */
export function newSince(row: Row, since: string | null): NewReason[] {
  if (!since) return []
  const out: NewReason[] = []
  if (row.date_iso && row.date_iso > since) out.push("round")
  if (liveRoles(row.name)?.design.some((d) => d.published && d.published > since)) out.push("role")
  if (FEED.companies[row.name]?.news?.some((n) => n.tag === "hire" && n.date > since)) out.push("hire")
  return out
}

export const NEW_LABEL: Record<NewReason, string> = {
  round: "round",
  role: "design role",
  hire: "hire news",
}
