"use client"

import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { STATUS_ICON } from "@/components/radar/status-select"
import { GROUP_COLOR, LABEL, type Group } from "@/lib/radar"
import { STATUSES } from "@/lib/track"

const GROUPS: Group[] = ["apply", "check", "warm"]

function Items() {
  return (
    <>
      {GROUPS.map((g) => (
        <span key={g} className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full" style={{ backgroundColor: GROUP_COLOR[g] }} />
          {LABEL[g].toLowerCase()}
        </span>
      ))}
      <span>○ hollow = undisclosed</span>
      <span>┄ dashed = approx. date</span>
      <span className="inline-flex items-center gap-1">
        <span className="size-2 rounded-full bg-sky-500" />
        new since last visit
      </span>
      <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
        my status:
        {STATUSES.filter((s) => STATUS_ICON[s.value]).map((s) => {
          const Icon = STATUS_ICON[s.value]!
          return (
            <span key={s.value} className="inline-flex items-center gap-0.5" title={s.label}>
              <span className="grid size-3.5 place-items-center rounded-full bg-foreground text-background">
                <Icon className="size-2" strokeWidth={3} aria-hidden />
              </span>
              <span className="sr-only sm:not-sr-only">{s.label.toLowerCase()}</span>
            </span>
          )
        })}
      </span>
    </>
  )
}

/** One muted line under the chart from sm; on phones it folds into an "ⓘ Legend" popover. */
export function ChartLegend() {
  return (
    <>
      <p className="hidden flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground sm:flex">
        <Items />
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="w-fit px-2 text-xs text-muted-foreground sm:hidden">
            <InfoIcon aria-hidden />
            Legend
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-72 flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <Items />
        </PopoverContent>
      </Popover>
    </>
  )
}
