"use client"

import {
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarClockIcon,
  CircleDotIcon,
  CoinsIcon,
  GaugeIcon,
  HourglassIcon,
  LandmarkIcon,
  LaptopIcon,
  ListChecksIcon,
  MapPinIcon,
  StarIcon,
} from "lucide-react"

import { createFilterQuery, createFilterRule, isFilterRule } from "@/components/reui/filters/filters-query"
import type { FilterField, FilterNode, FilterQuery, FilterRule } from "@/components/reui/filters/filters-types"
import { GROUP_COLOR, LABEL, type Group, type Row } from "@/lib/radar"
import type { NewReason } from "@/lib/seen"
import { STATUSES, type Status } from "@/lib/track"

/** A row with this browser's tracking merged in, so status and follow-ups filter like any column. */
export type TrackedRow = Row & {
  status: Status
  followUp?: string
  note?: string
  due: boolean
  /** What appeared since the previous visit (empty on a first visit). */
  isNew: NewReason[]
  /** Open roles in the selected family; null = [TBC]. */
  familyCount: number | null
}

const GROUPS: Group[] = ["apply", "check", "warm", "watch"]

function Dot({ color }: { color: string }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
}

const select = (
  id: string,
  label: string,
  icon: React.ReactNode,
  options: { value: string; label: string; icon?: React.ReactNode }[],
): FilterField => ({
  id,
  label,
  type: "select",
  defaultOperator: "is_any_of",
  searchable: false,
  options,
  icon,
})

export const FIELDS: FilterField[] = [
  { id: "name", label: "Company", type: "text", defaultOperator: "contains", icon: <Building2Icon /> },
  select(
    "group",
    "Group",
    <CircleDotIcon />,
    GROUPS.map((g) => ({ value: g, label: LABEL[g], icon: <Dot color={GROUP_COLOR[g]} /> })),
  ),
  select(
    "status",
    "My status",
    <ListChecksIcon />,
    STATUSES.map((s) => ({ value: s.value, label: s.label, icon: <Dot color={s.color} /> })),
  ),
  { id: "due", label: "Follow-up due this week", type: "boolean", defaultOperator: "is", icon: <CalendarClockIcon /> },
  { id: "chance", label: "Chance", type: "range", defaultOperator: "between", icon: <GaugeIcon /> },
  {
    id: "hasDesignRole",
    label: "Has design role",
    type: "boolean",
    defaultOperator: "is",
    icon: <BriefcaseBusinessIcon />,
  },
  select("roleLevel", "Role level", <StarIcon />, [
    { value: "staff", label: "Staff / Principal" },
    { value: "senior", label: "Senior" },
    { value: "other", label: "Other" },
    { value: "none", label: "No open role" },
  ]),
  select("workplaceKind", "Workplace", <LaptopIcon />, [
    { value: "remote", label: "Remote" },
    { value: "hybrid", label: "Hybrid" },
    { value: "onsite", label: "On-site" },
    { value: "tbc", label: "[TBC]" },
  ]),
  select("place", "Munich / remote", <MapPinIcon />, [
    { value: "munich", label: "Munich" },
    { value: "remote", label: "Remote" },
    { value: "elsewhere", label: "Elsewhere" },
  ]),
  select("stage", "Round stage", <LandmarkIcon />, [
    { value: "seed", label: "Pre-seed / Seed" },
    { value: "a", label: "Series A" },
    { value: "b", label: "Series B" },
    { value: "cplus", label: "Series C+ / Growth" },
    { value: "strategic", label: "Strategic" },
    { value: "tbc", label: "[TBC]" },
  ]),
  {
    id: "freshness",
    label: "Round freshness",
    type: "select",
    defaultOperator: "is",
    searchable: false,
    options: [
      { value: "3", label: "≤ 3 months" },
      { value: "6", label: "≤ 6 months" },
      { value: "12", label: "≤ 12 months" },
    ],
    icon: <HourglassIcon />,
  },
  {
    id: "amount_m",
    label: "Amount (M, round currency)",
    type: "range",
    defaultOperator: "between",
    icon: <CoinsIcon />,
  },
]

function read(row: TrackedRow, path: string): unknown {
  return row[path as keyof TrackedRow]
}

function matchesRule(row: TrackedRow, rule: FilterRule): boolean {
  const path = rule.path[0]
  const value = rule.value
  // Freshness reads as "raised within N months"; a round without a date never matches.
  if (path === "freshness" && (rule.operator === "is" || rule.operator === "is_not")) {
    const inside = row.months !== null && row.months <= Number(value)
    const result = rule.operator === "is" ? inside : !inside
    return rule.negated ? !result : result
  }
  const actual = read(row, path)
  const result = (() => {
    switch (rule.operator) {
      case "contains":
        return String(actual ?? "")
          .toLowerCase()
          .includes(String(value).toLowerCase())
      case "not_contains":
        return !String(actual ?? "")
          .toLowerCase()
          .includes(String(value).toLowerCase())
      case "starts_with":
        return String(actual ?? "")
          .toLowerCase()
          .startsWith(String(value).toLowerCase())
      case "ends_with":
        return String(actual ?? "")
          .toLowerCase()
          .endsWith(String(value).toLowerCase())
      case "is":
      case "eq":
        return String(actual) === String(value)
      case "is_not":
      case "neq":
        return String(actual) !== String(value)
      case "is_any_of":
        return (value as string[] | undefined)?.includes(String(actual)) ?? true
      case "is_none_of":
        return !((value as string[] | undefined)?.includes(String(actual)) ?? false)
      case "between":
      case "not_between": {
        // An unknown amount is neither inside nor outside a range: it drops out of both.
        if (actual === null || actual === undefined) return false
        const [from, to] = ((value as unknown[] | undefined) ?? []).map((v) =>
          v === "" || v == null ? NaN : Number(v),
        )
        const inside = (Number.isNaN(from) || Number(actual) >= from) && (Number.isNaN(to) || Number(actual) <= to)
        return rule.operator === "between" ? inside : !inside
      }
      case "empty":
        return actual === undefined || actual === null || actual === ""
      case "not_empty":
        return !(actual === undefined || actual === null || actual === "")
      default:
        return true
    }
  })()
  return rule.negated ? !result : result
}

function isIncomplete(rule: FilterRule) {
  if (rule.operator === "empty" || rule.operator === "not_empty") return false
  return rule.value === undefined || (Array.isArray(rule.value) && rule.value.length === 0)
}

/** The query tree as a row predicate (pattern from ReUI's c-filters-7 example). */
export function matches(row: TrackedRow, node: FilterNode): boolean {
  if (isFilterRule(node)) return isIncomplete(node) ? true : matchesRule(row, node)
  if (node.rules.length === 0) return true
  return node.combinator === "and"
    ? node.rules.every((child) => matches(row, child))
    : node.rules.some((child) => matches(row, child))
}

let seq = 0
const rule = (path: string, operator: string, value: unknown) =>
  createFilterRule({ id: `r${++seq}`, path: [path], operator, value })

/** Background companies (no round date) are only in the grid, and hidden until asked for. */
const onRadar = () => rule("group", "is_any_of", ["apply", "check", "warm"])

export const defaultQuery = (): FilterQuery => createFilterQuery([onRadar()])

export type PresetId = "best" | "fresh" | "munich" | "warm" | "staff"

export const PRESETS: { id: PresetId; label: string; query: () => FilterQuery }[] = [
  {
    id: "best",
    label: "Best bets",
    query: () =>
      createFilterQuery([onRadar(), rule("chance", "between", [70, 100]), rule("hasDesignRole", "is", true)]),
  },
  { id: "fresh", label: "Fresh money", query: () => createFilterQuery([onRadar(), rule("freshness", "is", "3")]) },
  {
    id: "munich",
    label: "Munich only",
    query: () => createFilterQuery([onRadar(), rule("place", "is_any_of", ["munich"])]),
  },
  { id: "warm", label: "Warm intros", query: () => createFilterQuery([rule("group", "is_any_of", ["warm"])]) },
  {
    id: "staff",
    label: "Staff+ roles",
    query: () => createFilterQuery([onRadar(), rule("roleLevel", "is_any_of", ["staff"])]),
  },
]

/** What each KPI card applies when clicked. */
export const KPI_QUERIES = {
  radar: defaultQuery,
  roles: () => createFilterQuery([onRadar(), rule("hasDesignRole", "is", true)]),
  chance: () => createFilterQuery([onRadar(), rule("chance", "between", [70, 100])]),
  fresh: () => createFilterQuery([onRadar(), rule("freshness", "is", "3")]),
  due: () => createFilterQuery([rule("due", "is", true)]),
}
