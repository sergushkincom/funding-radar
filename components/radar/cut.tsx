"use client"

import * as React from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/** A one-line cell that ends in an ellipsis and shows the full text in a tooltip, only when it is actually cut. */
export function Cut({ text, className, children }: { text: string; className?: string; children?: React.ReactNode }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [open, setOpen] = React.useState(false)
  const check = (next: boolean) => {
    const el = ref.current
    setOpen(next && !!el && el.scrollWidth > el.clientWidth)
  }
  return (
    <Tooltip open={open} onOpenChange={check}>
      <TooltipTrigger asChild>
        <span ref={ref} className={cn("block min-w-0 truncate", className)}>
          {children ?? text}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{text}</TooltipContent>
    </Tooltip>
  )
}
