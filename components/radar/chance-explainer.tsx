"use client"

import { InfoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CHANCE_RULES } from "@/lib/radar"
import { cn } from "@/lib/utils"

/** "How chance works": what the y axis and the Chance column mean, factor by factor. */
export function ChanceExplainer({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon-xs" : "xs"}
          className={cn("text-muted-foreground", className)}
          aria-label="How chance works"
          onClick={(e) => e.stopPropagation()}
        >
          <InfoIcon aria-hidden />
          {compact ? null : "How chance works"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] text-xs">
        <p className="text-sm font-medium">Chance: points out of 100</p>
        <p className="mt-1 text-muted-foreground">
          Not money and not a forecast: a rule-based fit score for one product-design profile (B2B / ERP, AI agents,
          Munich or remote in Germany). Five factors add up to 100. Money is the bubble size.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {CHANCE_RULES.map((r) => (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 font-medium">
                <span>{r.label}</span>
                <span className="font-mono tabular-nums text-muted-foreground">up to {r.max}</span>
              </div>
              <p className="text-muted-foreground">{r.rule}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-muted-foreground">
          70+ is a strong match. Open a company to see its score factor by factor. Shown in the Designer view only.
        </p>
      </PopoverContent>
    </Popover>
  )
}
