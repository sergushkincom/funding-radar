"use client"

import * as React from "react"
import { CalendarClockIcon, SearchXIcon } from "lucide-react"
import { type ColumnDef, type SortingState, useTable } from "@tanstack/react-table"

import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from "@/components/reui/data-grid/data-grid"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { Filters } from "@/components/reui/filters/filters"
import type { FilterQuery } from "@/components/reui/filters/filters-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Tbc } from "@/components/radar/company-sheet"
import { Cut } from "@/components/radar/cut"
import { FIELDS, type TrackedRow } from "@/components/radar/filters"
import { StatusSelect } from "@/components/radar/status-select"
import { FAMILY_VIEWS, type FamilyView } from "@/lib/feed"
import { GROUP_COLOR, LABEL, ROWS, ago, fmtDate, type Group } from "@/lib/radar"
import { NEW_LABEL, type NewReason } from "@/lib/seen"
import { STATUSES, type Status } from "@/lib/track"
import { cn } from "@/lib/utils"

const GROUPS: Group[] = ["apply", "check", "warm", "watch"]

function NewDot({ reasons }: { reasons: NewReason[] }) {
  const label = "New: " + reasons.map((r) => NEW_LABEL[r]).join(", ")
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={`${label} (since your last visit)`}
          className="size-2 shrink-0 rounded-full bg-sky-500"
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ChanceBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn("w-6 text-right tabular-nums", value >= 70 && "font-semibold")}>{value}</span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn("block h-full rounded-full", value >= 70 ? "bg-foreground" : "bg-muted-foreground/60")}
          style={{ width: `${value}%` }}
        />
      </span>
    </span>
  )
}

export function CompaniesGrid({
  rows,
  query,
  onQueryChange,
  onReset,
  selected,
  onSelect,
  onStatus,
  family = "designer",
}: {
  rows: TrackedRow[]
  query: FilterQuery
  onQueryChange: (q: FilterQuery) => void
  onReset: () => void
  selected: string | null
  onSelect: (name: string) => void
  onStatus: (name: string, status: Status) => void
  family?: FamilyView
}) {
  const view = FAMILY_VIEWS.find((f) => f.value === family)!
  const designView = family === "designer"
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "chance", desc: true }])

  const columns = React.useMemo<ColumnDef<DataGridFeatures, TrackedRow>[]>(
    () => [
      {
        accessorKey: "name",
        id: "name",
        header: ({ column }) => <DataGridColumnHeader title="Company" column={column} />,
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-1.5">
            <Cut
              text={row.original.name}
              className={cn("font-medium", selected === row.original.name && "underline underline-offset-4")}
            />
            {row.original.isNew.length > 0 && <NewDot reasons={row.original.isNew} />}
          </span>
        ),
        size: 140,
        enableSorting: true,
      },
      {
        id: "status",
        accessorFn: (row) => STATUSES.findIndex((s) => s.value === row.status),
        header: ({ column }) => <DataGridColumnHeader title="My status" column={column} />,
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            <StatusSelect
              size="sm"
              value={row.original.status}
              onChange={(s) => onStatus(row.original.name, s)}
              label={`Status for ${row.original.name}`}
              className="h-7 w-full min-w-0 border-transparent bg-transparent px-1.5 shadow-none hover:border-input"
            />
            {row.original.due && (
              <CalendarClockIcon
                className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-label="Follow-up due this week"
              />
            )}
          </span>
        ),
        size: 160,
        enableSorting: true,
      },
      {
        id: "group",
        accessorFn: (row) => GROUPS.indexOf(row.group),
        header: ({ column }) => <DataGridColumnHeader title="Group" column={column} />,
        cell: ({ row }) => (
          <Badge variant="outline" className="gap-1.5 font-normal">
            <span className="size-2 rounded-full" style={{ backgroundColor: GROUP_COLOR[row.original.group] }} />
            {LABEL[row.original.group]}
          </Badge>
        ),
        size: 185,
        enableSorting: true,
      },
      {
        accessorKey: "chance",
        id: "chance",
        header: ({ column }) => <DataGridColumnHeader title="Chance" column={column} />,
        // The score is tuned to the design profile: shown muted in the other views.
        cell: ({ row }) => (
          <span
            className={cn(!designView && "opacity-40")}
            title={designView ? undefined : "Chance: design profile only"}
          >
            <ChanceBar value={row.original.chance} />
          </span>
        ),
        size: 110,
        enableSorting: true,
      },
      {
        id: "amount",
        accessorFn: (row) => row.amount_m ?? -1,
        header: ({ column }) => <DataGridColumnHeader title="Round" column={column} />,
        cell: ({ row }) => {
          const amount = /undisclosed/.test(row.original.amount) ? "undisclosed" : row.original.amount || "[TBC]"
          return (
            <Cut text={row.original.amount || "[TBC]"}>
              <Tbc>{amount}</Tbc>
            </Cut>
          )
        },
        size: 115,
        enableSorting: true,
      },
      {
        id: "date",
        accessorFn: (row) => (row.date_iso ? new Date(row.date_iso).getTime() : 0),
        header: ({ column }) => <DataGridColumnHeader title="Round date" column={column} />,
        cell: ({ row }) => (
          <span className="flex flex-col whitespace-nowrap">
            <Tbc>{fmtDate(row.original)}</Tbc>
            {row.original.date_iso && <span className="text-xs text-muted-foreground">{ago(row.original)}</span>}
          </span>
        ),
        size: 115,
        enableSorting: true,
      },
      {
        id: "familyRoles",
        accessorFn: (row) => row.familyCount ?? -1,
        header: ({ column }) => <DataGridColumnHeader title={view.column} column={column} />,
        cell: ({ row }) =>
          row.original.familyCount === null ? (
            <Tbc>[TBC]</Tbc>
          ) : (
            <span className="tabular-nums">{row.original.familyCount}</span>
          ),
        size: 125,
        enableSorting: true,
      },
      {
        accessorKey: "team",
        id: "team",
        header: ({ column }) => <DataGridColumnHeader title="Team" column={column} />,
        cell: ({ row }) => (
          <Cut text={row.original.team || "[TBC]"}>
            <Tbc>{row.original.team || "[TBC]"}</Tbc>
          </Cut>
        ),
        size: 120,
        enableSorting: false,
      },
      {
        accessorKey: "city",
        id: "city",
        header: ({ column }) => <DataGridColumnHeader title="City" column={column} />,
        cell: ({ row }) => <Cut text={row.original.city} />,
        size: 140,
        enableSorting: true,
      },
    ],
    [selected, onStatus, view, designView],
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (row: TrackedRow) => row.id,
    state: { sorting, pagination: { pageIndex: 0, pageSize: 100 } },
    onSortingChange: setSorting,
  })

  return (
    <DataGrid
      table={table}
      recordCount={rows.length}
      emptyMessage={
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <SearchXIcon className="size-6" aria-hidden />
          <p>No companies match.</p>
          <Button size="sm" variant="outline" onClick={onReset}>
            Reset filters
          </Button>
        </div>
      }
      onRowClick={(row) => onSelect(row.name)}
      tableLayout={{ dense: true }}
      tableClassNames={{ bodyRow: "cursor-pointer hover:bg-muted/60" }}
    >
      <Card className="w-full gap-0 overflow-visible py-0 shadow-xs">
        {/* Sticky while the page scrolls past the grid; the page header is not fixed, so top-0. */}
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-t-xl border-b bg-card/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <Filters fields={FIELDS} query={query} onQueryChange={onQueryChange} showClear />
          <span className="ml-auto text-xs text-muted-foreground tabular-nums" aria-live="polite">
            {rows.length} of {ROWS.length} companies
          </span>
        </div>
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground lg:hidden">Scroll → for more columns</p>
      </Card>
    </DataGrid>
  )
}
