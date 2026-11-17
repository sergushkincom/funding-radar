"use client"

import * as React from "react"
import { SearchIcon, XIcon } from "lucide-react"

import type { FilterQuery } from "@/components/reui/filters/filters-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CompaniesGrid } from "@/components/radar/companies-grid"
import { CompanySheet } from "@/components/radar/company-sheet"
import { KPI_QUERIES, PRESETS, defaultQuery, matches, type PresetId, type TrackedRow } from "@/components/radar/filters"
import { ChartLegend } from "@/components/radar/chart-legend"
import { RadarChart } from "@/components/radar/radar-chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ThemeToggle } from "@/components/theme-toggle"
import { BACKGROUND, DATA_DATE, JOBS, RADAR, ROWS } from "@/lib/radar"
import { FAMILY_VIEWS, FEED, familyRoles, fmtDay, type FamilyView } from "@/lib/feed"
import { newSince, usePreviousVisit } from "@/lib/seen"
import { STATUSES, isDueThisWeek, useTrack, type Status } from "@/lib/track"
import { cn } from "@/lib/utils"


type KpiId = keyof typeof KPI_QUERIES

export function RadarApp() {
  const [selected, setSelected] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState<FilterQuery>(defaultQuery)
  const [search, setSearch] = React.useState("")
  // Which preset or KPI set the current filters; cleared as soon as the filters are edited by hand.
  const [active, setActive] = React.useState<PresetId | KpiId | null>(null)
  const { track, update } = useTrack()
  const since = usePreviousVisit()
  // Which roles the counts, bubbles and lists are about. The chance score is for the design profile only.
  const [family, setFamily] = React.useState<FamilyView>("designer")
  const view = FAMILY_VIEWS.find((f) => f.value === family)!

  const tracked = React.useMemo<TrackedRow[]>(
    () =>
      ROWS.map((r) => {
        const t = track[r.name]
        return {
          ...r,
          status: t?.status ?? "not_started",
          followUp: t?.followUp,
          note: t?.note,
          due: isDueThisWeek(t?.followUp),
          isNew: newSince(r, since),
          familyCount: familyRoles(r.name, family, JOBS[r.name])?.count ?? null,
        }
      }),
    [track, since, family],
  )

  const term = search.trim().toLowerCase()
  const filtered = React.useMemo(
    () => tracked.filter((r) => matches(r, query) && (!term || r.name.toLowerCase().includes(term))),
    [tracked, query, term],
  )
  const onChart = filtered.filter((r) => r.group !== "watch")
  const dueCount = tracked.filter((r) => r.due).length
  // Each chip shows how many companies it would leave (ignoring the search box).
  const presetCounts = React.useMemo(
    () => Object.fromEntries(PRESETS.map((p) => [p.id, tracked.filter((r) => matches(r, p.query())).length])),
    [tracked],
  )

  const apply = (id: PresetId | KpiId, q: FilterQuery) => {
    if (active === id) {
      setQuery(defaultQuery())
      setActive(null)
      return
    }
    setQuery(q)
    setActive(id)
  }
  const reset = () => {
    setQuery(defaultQuery())
    setSearch("")
    setActive(null)
  }
  const onStatus = React.useCallback((name: string, status: Status) => update(name, { status }), [update])

  const kpis: { id: KpiId; value: number; label: string }[] = [
    { id: "radar", value: RADAR.length, label: "companies on the radar" },
    { id: "roles", value: tracked.reduce((a, r) => a + (r.familyCount ?? 0), 0), label: `${view.kpi}*` },
    { id: "chance", value: ROWS.filter((r) => r.chance >= 70).length, label: "chance 70+" },
    {
      id: "fresh",
      value: ROWS.filter((r) => r.months !== null && r.months <= 3).length,
      label: "raised ≤ 3 months ago",
    },
    { id: "due", value: dueCount, label: "follow-ups due this week" },
  ]

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              Funding radar · rounds {DATA_DATE} · roles &amp; news {fmtDay(FEED.generated)}
            </p>
            <ThemeToggle />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Who just raised, and my chances</h1>
          <p className="max-w-3xl text-muted-foreground">
            Each bubble is a company that raised in the last 12 months. Further right: more recent round. Higher: better
            chance (design profile). Size: round amount. Number: open {view.kpi.replace("open ", "")}.
          </p>
        </div>
        <div className="relative -mx-4 sm:mx-0">
          {/* Phones: one scrolling row of compact cards, so the chart stays near the top. From sm: a grid. */}
          <ul className="flex snap-x gap-2 overflow-x-auto px-4 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 md:grid-cols-5">
            {kpis.map((k) => (
              <li key={k.id} className="w-36 shrink-0 snap-start sm:w-auto">
                <button
                  type="button"
                  aria-pressed={active === k.id}
                  onClick={() => apply(k.id, KPI_QUERIES[k.id]())}
                  className={cn(
                    "flex h-full w-full flex-col items-start gap-0.5 rounded-xl border bg-card px-3 py-2.5 sm:gap-1 sm:px-4 sm:py-3 text-left shadow-xs transition-shadow outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50",
                    active === k.id && "border-foreground/40 shadow-md",
                  )}
                >
                  <span className="text-xl font-semibold tabular-nums sm:text-2xl">{k.value}</span>
                  <span className="text-xs leading-snug text-muted-foreground md:whitespace-nowrap">{k.label}</span>
                </button>
              </li>
            ))}
          </ul>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent sm:hidden"
          />
        </div>
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={family}
          onValueChange={(v) => v && setFamily(v as FamilyView)}
          aria-label="Role family"
          className="w-full sm:w-fit"
        >
          {FAMILY_VIEWS.map((f) => (
            <ToggleGroupItem key={f.value} value={f.value} className="flex-1 px-3 sm:flex-none">
              {f.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="relative md:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies"
            aria-label="Search companies by name"
            className="pl-8"
          />
        </div>
        <div role="group" aria-label="Quick filters" className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={active === p.id ? "default" : "outline"}
              aria-pressed={active === p.id}
              className="rounded-full"
              onClick={() => apply(p.id, p.query())}
            >
              {p.label}
              <span className={cn("tabular-nums", active === p.id ? "opacity-70" : "text-muted-foreground")}>
                {presetCounts[p.id]}
              </span>
            </Button>
          ))}
          {(active || term) && (
            <Button size="sm" variant="ghost" className="rounded-full" onClick={reset}>
              <XIcon aria-hidden />
              Reset
            </Button>
          )}
        </div>
      </div>

      <Card className="gap-2 shadow-sm">
        <CardHeader>
          <CardTitle>Round date × chance</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <RadarChart rows={onChart} selected={selected} onSelect={setSelected} family={family} />
          <ChartLegend />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">All companies</h2>
          <p className="text-sm text-muted-foreground">
            {RADAR.length} on the radar and {BACKGROUND.length} in the background (no round date, hidden by the default
            filter). Click a row for details. Status, follow-ups and notes are saved in this browser only.
          </p>
        </div>
        <CompaniesGrid
          rows={filtered}
          query={query}
          onQueryChange={(q) => {
            setQuery(q)
            setActive(null)
          }}
          onReset={reset}
          selected={selected}
          onSelect={setSelected}
          onStatus={onStatus}
          family={family}
        />
      </section>

      <footer className="flex flex-col gap-1 text-xs leading-relaxed text-muted-foreground">
        <p>
          * Open roles from the public Ashby and Personio APIs, refreshed daily (last {fmtDay(FEED.generated)}). For
          companies without a careers feed the count is [TBC] (&quot;?&quot; on the bubble). Families come from
          job-title keyword rules: design = product design, design engineer, design manager (not brand/graphic, not
          research); Developer = engineering + data/ML; PM = product management; students and interns are not counted.
        </p>
        <p>
          Chance = an estimate from 5 rules (freshness 20 · role 35 · topic 25 · location 10 · team 10), not a forecast.
          Amounts are in the round&apos;s currency, not converted. Round stage &quot;C+&quot; includes growth rounds.
        </p>
        <p>
          News via Google News RSS, linking to the original sources. Roles from public Ashby and Personio job boards.
          Personal tracking (status, follow-ups, notes) stays in this browser.
        </p>
        <p className="flex flex-wrap gap-x-3">
          Status colours:
          {STATUSES.slice(1).map((s) => (
            <span key={s.value} className="flex items-center gap-1">
              <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </p>
      </footer>

      <CompanySheet
        name={selected}
        onClose={() => setSelected(null)}
        entry={selected ? track[selected] : undefined}
        onUpdate={update}
        family={family}
      />
    </div>
  )
}
