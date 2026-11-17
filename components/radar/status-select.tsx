"use client"

import { CheckIcon, FlagIcon, MailIcon, MessageCircleIcon, StarIcon, XIcon, type LucideIcon } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUSES, STATUS_BY_VALUE, type Status } from "@/lib/track"
import { cn } from "@/lib/utils"

/** One icon per status, for the chart badge and its legend (the chart ring itself stays neutral). */
export const STATUS_ICON: Partial<Record<Status, LucideIcon>> = {
  saved: StarIcon,
  applied: CheckIcon,
  intro_sent: MailIcon,
  interviewing: MessageCircleIcon,
  rejected: XIcon,
  offer: FlagIcon,
}

export function StatusMark({ status }: { status: Status }) {
  const s = STATUS_BY_VALUE[status]
  if (status === "saved") return <StarIcon className="size-3.5 fill-current" style={{ color: s.color }} aria-hidden />
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        status === "not_started" && "border border-muted-foreground bg-transparent",
      )}
      style={status === "not_started" ? undefined : { backgroundColor: s.color }}
    />
  )
}

export function StatusSelect({
  value,
  onChange,
  size = "default",
  className,
  label,
}: {
  value: Status
  onChange: (next: Status) => void
  size?: "sm" | "default"
  className?: string
  /** Accessible name, e.g. "Status for Synthesia". */
  label: string
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Status)}>
      <SelectTrigger
        size={size}
        aria-label={label}
        className={className}
        // Inside a grid row: choosing a status must not also open the company panel.
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {STATUSES.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            <StatusMark status={s.value} />
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
