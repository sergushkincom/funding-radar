"use client"

import * as React from "react"
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon, SparklesIcon, TrendingUpIcon } from "lucide-react"

import {
  GROUP_COLOR,
  JOBS,
  LABEL,
  ROWS,
  ago,
  amountShort,
  fmtDate,
  investors,
  nextStep,
  roles,
  roundType,
} from "@/lib/radar"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { StatusSelect } from "@/components/radar/status-select"
import {
  FAMILY_VIEWS,
  FEED,
  SOURCES,
  familyRoles,
  fmtDay,
  hiringSignal,
  liveRoles,
  type FamilyView,
  type NewsTag,
} from "@/lib/feed"

/** Long lists (All at a big company) end with a link to the careers page. */
const ROLE_LIST_MAX = 10
import { isDueThisWeek, type Entry } from "@/lib/track"

/** "[TBC]" gaps stay visible as gaps, never filled in. */
export function Tbc({ children }: { children: string }) {
  const parts = children.split(/(\[TBC[^\]]*\])/g)
  return (
    <>
      {parts.map((part, i) =>
        /^\[TBC/.test(part) ? (
          <span key={i} className="font-mono text-xs text-amber-600 dark:text-amber-400">
            {part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  )
}

/** The score's reasons are lowercase fragments; capitalise the first and close the sentence. */
const sentence = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) + "." : "")

const RING_R = 36
const RING_C = 2 * Math.PI * RING_R

/**
 * New key each time the sheet opens onto a company, so the CSS draw can run again.
 * Closing keeps the key: the panel slides away still filled.
 */
function useDrawKey(open: boolean, company: string) {
  const token = open ? company : null
  const [seen, setSeen] = React.useState(token)
  const [key, setKey] = React.useState(0)
  if (token !== seen) {
    setSeen(token)
    if (token !== null) setKey(key + 1)
  }
  return key
}

function ChanceRing({ value, color }: { value: number; color: string }) {
  return (
    <div className="relative size-[86px] shrink-0">
      <svg viewBox="0 0 86 86" className="size-full -rotate-90">
        <circle cx="43" cy="43" r={RING_R} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="43"
          cy="43"
          r={RING_R}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          className="chance-ring-arc"
          style={
            {
              "--ring-c": `${RING_C}px`,
              "--ring-pct": value / 100,
            } as React.CSSProperties
          }
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  )
}

function FactorBars({
  factors,
  color,
}: {
  factors: { label: string; value: number; max: number; why: string }[]
  color: string
}) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-x-3 gap-y-2 text-xs">
      {factors.map((f, i) => (
        <React.Fragment key={f.label}>
          <span className="truncate text-muted-foreground" title={f.why}>
            {f.label}
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="factor-bar h-full rounded-full"
              style={
                {
                  "--bar": `${(f.value / f.max) * 100}%`,
                  "--i": i,
                  backgroundColor: color,
                } as React.CSSProperties
              }
            />
          </div>
          <span className="text-right tabular-nums">
            {f.value}/{f.max}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function CompanySheet({
  name,
  onClose,
  entry,
  onUpdate,
  family = "designer",
}: {
  name: string | null
  onClose: () => void
  /** This browser's tracking for the company, if any. */
  entry: Entry | undefined
  onUpdate: (name: string, patch: Partial<Entry>) => void
  family?: FamilyView
}) {
  const desktop = useMediaQuery("(min-width: 768px)", true)
  // Keep the last company while the sheet animates out.
  const [shown, setShown] = React.useState(name)
  if (name && name !== shown) setShown(name)
  const c = ROWS.find((r) => r.name === (name ?? shown))

  return (
    <Sheet open={name !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        // Focus the panel itself, not its first control: otherwise the AI stub's tooltip pops open on every open.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          ;(e.currentTarget as HTMLElement | null)?.focus()
        }}
        className="gap-0 shadow-2xl data-[side=bottom]:max-h-[85dvh] data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {c && <Body c={c} open={name !== null} entry={entry} onUpdate={onUpdate} family={family} />}
      </SheetContent>
    </Sheet>
  )
}

function Body({
  c,
  open,
  entry,
  onUpdate,
  family,
}: {
  c: (typeof ROWS)[number]
  open: boolean
  entry: Entry | undefined
  onUpdate: (name: string, patch: Partial<Entry>) => void
  family: FamilyView
}) {
  const designView = family === "designer"
  const drawKey = useDrawKey(open, c.name)
  const view = FAMILY_VIEWS.find((f) => f.value === family)!
  // The roles of the selected family; designer view falls back to the research's own role (e.g. Voiceline).
  const fam = familyRoles(c.name, family, JOBS[c.name])
  const famList = fam ? fam.list : designView ? roles(c) : []
  const shownRoles = famList.slice(0, ROLE_LIST_MAX)
  const hidden = (fam ? fam.count : famList.length) - shownRoles.length
  const col = GROUP_COLOR[c.group]
  const jobs = JOBS[c.name]
  const rs = roles(c)
  const next = nextStep(c.group)
  // Only groups with an open role link to a posting; warm intro and watch have none.
  // In the other families the next step is about design, so the button opens the careers page instead.
  const careersUrl = SOURCES[c.name]?.careers?.url
  const jobUrl = designView ? (c.group === "apply" || c.group === "check" ? rs[0]?.url : undefined) : careersUrl
  const buttonLabel = designView ? next.title : "Open careers page"
  const minusLine = c.score.why.find((w) => w.startsWith("minus: "))
  const plus = c.score.why.find((w) => !w.startsWith("minus: ")) ?? ""
  const minus = minusLine?.slice("minus: ".length) ?? ""

  return (
    <>
      <SheetHeader className="gap-2 border-b pr-12">
        <Badge variant="outline" className="w-fit gap-1.5">
          <span className="size-2 rounded-full" style={{ backgroundColor: col }} />
          {LABEL[c.group]}
        </Badge>
        <SheetTitle className="text-2xl">{c.name}</SheetTitle>
        <SheetDescription>
          {c.city}
          {c.what ? ` · ${c.what}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
        <Tracking c={c} entry={entry} onUpdate={onUpdate} />

        {designView ? (
          <>
            <div className="flex items-center gap-4 rounded-lg border bg-muted/40 p-4">
              <ChanceRing key={drawKey} value={c.chance} color={col} />
              <div className="flex flex-col gap-1.5 text-sm">
                {plus && (
                  <p>
                    <Tbc>{sentence(plus)}</Tbc>
                  </p>
                )}
                {minus && (
                  <p className="text-muted-foreground">
                    <Tbc>{"Minus: " + minus + "."}</Tbc>
                  </p>
                )}
                <p className="font-mono text-[11px] text-muted-foreground uppercase">
                  Chance · rule-based estimate, not a forecast
                </p>
              </div>
            </div>

            <FactorBars key={drawKey} factors={c.score.factors} color={col} />
          </>
        ) : (
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Chance: design profile only. The score and its reasons are tuned to one product-design profile; switch to Designer to see
            them.
          </p>
        )}

        <Separator />

        <Section title="Round">
          <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Amount</dt>
            <dd>
              <Tbc>{amountShort(c)}</Tbc>
              {c.valuation && (
                <>
                  {" · valuation "}
                  <Tbc>{c.valuation}</Tbc>
                </>
              )}
            </dd>
            <dt className="text-muted-foreground">When</dt>
            <dd>
              <Tbc>{`${fmtDate(c)} · ${ago(c)}`}</Tbc>
            </dd>
            <dt className="text-muted-foreground">Type</dt>
            <dd>{roundType(c.round)}</dd>
            <dt className="text-muted-foreground">Investors</dt>
            <dd>
              <Tbc>{investors(c.round)}</Tbc>
            </dd>
            <dt className="text-muted-foreground">Team</dt>
            <dd>
              <Tbc>{c.team || "[TBC]"}</Tbc>
            </dd>
          </dl>
        </Section>

        <Separator />

        <Section
          title={
            fam
              ? `Roles · ${fam.count} ${fam.count === 1 ? view.kpi.replace("open ", "").replace(/roles/, "role") : view.kpi.replace("open ", "")}${jobs ? ` · ${jobs.total} open in total` : ""}`
              : "Roles"
          }
        >
          {shownRoles.length ? (
            <ul className="flex flex-col gap-1.5">
              {shownRoles.map((r) => (
                <li key={r.url || r.title}>
                  <a
                    href={r.url || undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <span className="min-w-0">{r.title}</span>
                    <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-muted-foreground">
                      <Tbc>{(r.loc || "").slice(0, 22)}</Tbc>
                      <ArrowUpRightIcon className="size-3" aria-hidden />
                      <span className="sr-only">(opens in a new tab)</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {fam ? `No ${view.kpi.replace("open ", "").replace(/s$/, "")}` : <Tbc>{`${view.column} [TBC]`}</Tbc>}
              {!fam && !designView && " until the careers page is read by the daily refresh"}
            </p>
          )}
          {hidden > 0 && (
            <p className="text-xs text-muted-foreground">
              {`+${hidden} more`}
              {SOURCES[c.name]?.careers?.url && (
                <>
                  {" on the "}
                  <a
                    href={SOURCES[c.name]!.careers!.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    careers page
                  </a>
                </>
              )}
            </p>
          )}
          <HiringLine name={c.name} family={family} />
        </Section>

        <Separator />

        <LatestNews name={c.name} />

        <Separator />

        <Links name={c.name} />

        {designView && (
          <>
            <Separator />
            <Section title="Next step">
              <p className="text-sm">{next.detail}.</p>
            </Section>
          </>
        )}
      </div>

      <SheetFooter className="flex-row gap-2 border-t">
        {jobUrl ? (
          <Button asChild className="flex-1">
            <a href={jobUrl} target="_blank" rel="noreferrer">
              {buttonLabel}
              <ArrowUpRightIcon aria-hidden />
            </a>
          </Button>
        ) : (
          <Button className="flex-1" disabled>
            {designView ? next.title : "Careers page [TBC]"}
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            {/* aria-disabled rather than disabled, so the tooltip still explains why on hover and focus. */}
            <Button
              variant="outline"
              aria-disabled
              onClick={(e) => e.preventDefault()}
              className="flex-1 cursor-not-allowed border-dashed text-muted-foreground"
            >
              <SparklesIcon aria-hidden />
              AI chance check
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Not built yet. Idea: compare a CV with the job description and return a chance with reasons.
          </TooltipContent>
        </Tooltip>
      </SheetFooter>
    </>
  )
}

/** Status, follow-up and one note line: saved in this browser as you type. */
function Tracking({
  c,
  entry,
  onUpdate,
}: {
  c: (typeof ROWS)[number]
  entry: Entry | undefined
  onUpdate: (name: string, patch: Partial<Entry>) => void
}) {
  const id = React.useId()
  const due = isDueThisWeek(entry?.followUp)
  return (
    <section aria-label="My tracking" className="grid grid-cols-2 gap-3 rounded-lg border p-3 shadow-xs">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">My status</span>
        <StatusSelect
          value={entry?.status ?? "not_started"}
          onChange={(status) => onUpdate(c.name, { status })}
          label={`Status for ${c.name}`}
          className="w-full"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-follow`} className="text-xs text-muted-foreground">
          Follow-up{due && <span className="text-amber-600 dark:text-amber-400"> · due this week</span>}
        </Label>
        <Input
          id={`${id}-follow`}
          type="date"
          value={entry?.followUp ?? ""}
          onChange={(e) => onUpdate(c.name, { followUp: e.target.value || undefined })}
        />
      </div>
      <div className="col-span-2 flex flex-col gap-1.5">
        <Label htmlFor={`${id}-note`} className="text-xs text-muted-foreground">
          Note
        </Label>
        <Input
          id={`${id}-note`}
          value={entry?.note ?? ""}
          maxLength={200}
          placeholder="One line, e.g. who to write to"
          onChange={(e) => onUpdate(c.name, { note: e.target.value || undefined })}
        />
      </div>
    </section>
  )
}

/** Hiring signal from the daily snapshot: new design roles in 30 days and the total-roles trend. */
function HiringLine({ name, family }: { name: string; family: FamilyView }) {
  const sig = hiringSignal(name, family)
  const noun = FAMILY_VIEWS.find((f) => f.value === family)!.kpi.replace("open ", "")
  const roles = FEED.companies[name]?.roles
  if (!sig) {
    if (!roles) return null
    return (
      <p className="text-xs text-muted-foreground">
        Roles not refreshed: <Tbc>{roles.error ? "[TBC: careers page unreachable]" : "[TBC]"}</Tbc>
        {roles.checked && <> · last good check {fmtDay(roles.checked)}</>}
      </p>
    )
  }
  const t = sig.trend
  const delta = t ? t.to - t.from : 0
  return (
    <div className="flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1 font-medium">
          <TrendingUpIcon className="size-3.5" aria-hidden />
          Hiring signal
        </span>
        {/* From the ATS publish dates, so this is real from day one; only the trend needs history. */}
        <span>
          {sig.new30 > 0
            ? `${sig.new30} ${sig.new30 === 1 ? noun.replace(/s$/, "") : noun} posted in the last 30 days`
            : `No new ${noun} in 30 days${sig.newestPublished ? ` (newest posted ${fmtDay(sig.newestPublished)})` : ""}`}
        </span>
        <span className="flex items-center gap-1">
          {t ? (
            <>
              {delta > 0 ? (
                <ArrowUpRightIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : delta < 0 ? (
                <ArrowDownRightIcon className="size-3.5 text-rose-600 dark:text-rose-400" aria-hidden />
              ) : (
                <MinusIcon className="size-3.5" aria-hidden />
              )}
              {`${t.from} → ${t.to} open roles since ${fmtDay(t.since)}`}
            </>
          ) : (
            <span className="text-muted-foreground">
              Tracking since {fmtDay(sig.since)} · the roles trend shows after a week
            </span>
          )}
        </span>
      </p>
      <p className="text-muted-foreground">Roles checked {fmtDay(sig.checked)}</p>
    </div>
  )
}

// Only real signals get a tag; "other" shows none. Same outline style, each in its own muted colour.
const TAG_CLASS: Record<Exclude<NewsTag, "other">, string> = {
  funding: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  launch: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  hire: "border-violet-500/40 text-violet-700 dark:text-violet-300",
}

/** The 3 newest items from the snapshot. Every item links to its source; nothing without one is shown. */
function LatestNews({ name }: { name: string }) {
  const entry = FEED.companies[name]
  const filterOn = SOURCES[name]?.news
  const items = (entry?.news ?? []).filter((n) => n.url)
  return (
    <Section title="Latest news">
      {!filterOn ? (
        <p className="text-sm text-muted-foreground">
          <Tbc>[TBC]</Tbc> No news filter for this name yet: it matches other companies too.
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No news items matched in the last 12 months.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((n) => (
            <li key={n.url}>
              <a
                href={n.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">{n.title}</span>
                  <ArrowUpRightIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="tabular-nums">{fmtDay(n.date)}</span>·<span>{n.source || "[TBC]"}</span>
                  {n.tag !== "other" && (
                    <Badge variant="outline" className={`h-5 px-1.5 font-normal ${TAG_CLASS[n.tag]}`}>
                      {n.tag}
                    </Badge>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {filterOn && (
        <p className="text-xs text-muted-foreground">
          News checked {fmtDay(entry?.newsChecked)} · Google News · tags by keyword rules
          {entry?.newsError && <> · last check failed, showing the previous items</>}
        </p>
      )}
    </Section>
  )
}

function Links({ name }: { name: string }) {
  const src = SOURCES[name]
  const live = liveRoles(name)
  const links: { label: string; url: string | null }[] = [
    { label: "Website", url: src?.site ?? null },
    { label: "Careers", url: src?.careers?.url ?? null },
    { label: "LinkedIn", url: src?.linkedin ?? null },
  ]
  return (
    <Section title="Links">
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {links.map((l) =>
          l.url ? (
            <a
              key={l.label}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
            >
              {l.label}
              <ArrowUpRightIcon className="size-3" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <span key={l.label} className="text-muted-foreground">
              {l.label} <Tbc>[TBC]</Tbc>
            </span>
          ),
        )}
      </p>
      {!live && src?.careers && (
        <p className="text-xs text-muted-foreground">Careers page could not be read on the last check.</p>
      )}
    </Section>
  )
}
