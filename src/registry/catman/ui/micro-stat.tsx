"use client"

import type { ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * The small figures that sit under or beside a chart.
 *
 * `ChangeIndicator` is a movement with its direction and its verdict:
 * "vs LY ▲6.2%" in the favourable tone, "MAPE ▲7 pts" in the exposed one,
 * "flat" inside the noise. You say whether up is good.
 *
 * `MicroStat` is a labelled figure, "OTB $42k", with the sentence that
 * explains it in a tooltip.
 *
 * Part of the twelfth catman registry (`@twelfth/micro-stat`).
 */

function Hint({ hint, children, className }: { hint?: ReactNode; children: ReactNode; className?: string }) {
  if (!hint) return <span className={className}>{children}</span>
  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        render={<span tabIndex={0} />}
        className={cn("cursor-help rounded-sm underline decoration-dotted decoration-from-font underline-offset-2 outline-none transition-colors hover:decoration-solid focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-56 text-xs">{hint}</TooltipContent>
    </Tooltip>
  )
}

export function ChangeIndicator({
  value,
  label,
  higherIs,
  format = (magnitude) => magnitude.toLocaleString("en-AU", { maximumFractionDigits: 1 }),
  flatWithin = 0,
  strongAt,
  hint,
  className,
}: {
  /** Signed change; null renders nothing. */
  value: number | null
  /** What moved, e.g. "vs LY" or "MAPE". */
  label?: string
  /** Whether a rise is good news (sales, sell-through) or bad (forecast error, aged stock). */
  higherIs: "better" | "worse"
  /** Formats the size of the change, e.g. "6.2%" or "3.2 pts". */
  format?: (magnitude: number) => string
  /** Changes this small read "flat". */
  flatWithin?: number
  /** A worsening at least this large is set heavier, so it reads first. */
  strongAt?: number
  /** Explains how the change was measured. */
  hint?: ReactNode
  className?: string
}) {
  if (value === null || !Number.isFinite(value)) return null
  const prefix = label ? `${label} ` : ""
  if (Math.abs(value) <= flatWithin) {
    return <Hint hint={hint} className={cn("text-muted-foreground", className)}>{prefix}flat</Hint>
  }
  const worse = higherIs === "worse" ? value > 0 : value < 0
  const strong = worse && strongAt !== undefined && Math.abs(value) >= strongAt
  return (
    <Hint
      hint={hint}
      className={cn("whitespace-nowrap tabular-nums", worse ? "text-exposed-foreground" : "text-favourable-foreground", strong && "rounded-sm bg-exposed px-1 font-semibold", className)}
    >
      {prefix}{value > 0 ? "▲" : "▼"}{format(Math.abs(value))}
    </Hint>
  )
}

export function MicroStat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <Hint hint={hint} className={cn("whitespace-nowrap tabular-nums", className)}>
      {label} {value}
    </Hint>
  )
}
