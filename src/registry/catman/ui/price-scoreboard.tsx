"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/utils"
import { formatMarketPosition, formatUnits } from "@/registry/catman/lib/retail-format"
import { PriceTrend, type PriceTrendPoint } from "@/registry/catman/ui/price-trend"

/**
 * The four numbers at the top of a pricing page: where the range sits against
 * the market overall, then how many lines are priced above it, in line with
 * it, and below it. The three counts are filters when `onSelect` is given.
 *
 * Part of the Twelfth catman registry (`@twelfth/price-scoreboard`).
 */
export type PriceVerdict = "above" | "in_line" | "below"

export type PriceScoreboardCounts = Record<PriceVerdict, number>

const TILE = "flex flex-col justify-start rounded-xl border bg-card px-4 py-3 text-left"
const LINE = "flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
/** A selected filter is spotlit (ink border and a hard 2px offset) so it
 * cannot be mistaken for a hovered one. Nothing moves between states. */
const SPOTLIT = "border-foreground shadow-[0_2px_0_var(--color-foreground)]"
const RECEDED = "hover:border-foreground/35"

const LABELS: Record<PriceVerdict, string> = {
  above: "Priced above market",
  in_line: "In line with market",
  below: "Priced below market",
}

export function PriceScoreboard({
  positionPct,
  trend = [],
  counts,
  unitShares,
  selected = null,
  onSelect,
  info,
  className,
}: {
  /** The range's overall position vs the market, in percent; null when unknown. */
  positionPct: number | null
  /** Weekly position history for the sparkline. */
  trend?: PriceTrendPoint[]
  counts: PriceScoreboardCounts
  /** Each verdict's share of recent units, in percent, shown under its count. */
  unitShares?: Partial<Record<PriceVerdict, number | null>>
  /** The verdict currently filtering the list, if any. */
  selected?: PriceVerdict | null
  /** Makes the three counts filters. Clicking the selected one again should clear it. */
  onSelect?: (verdict: PriceVerdict) => void
  /** Sits beside the position, e.g. an (i) explaining the market bands. */
  info?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("@container w-full", className)}>
      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div role="group" aria-label="Position vs market" className={TILE}>
          <div className={LINE}>
            <span className="inline-flex items-center gap-1.5">
              <span className="text-lg font-medium tabular-nums">{formatMarketPosition(positionPct)}</span>
              {info}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {positionPct !== null ? <span className="font-mono">index {Math.round(100 + positionPct)}</span> : null}
              {trend.length ? <PriceTrend points={trend} label="Position vs market" width={48} height={16} /> : null}
            </span>
          </div>
        </div>
        {(Object.keys(LABELS) as PriceVerdict[]).map((verdict) => {
          const share = unitShares?.[verdict]
          const body = (
            <span className={LINE}>
              <span className="text-sm">{LABELS[verdict]}</span>
              <span className="font-mono text-lg font-medium tabular-nums">{formatUnits(counts[verdict])}</span>
              {share != null ? <span className="text-xs text-muted-foreground">{share}% of units</span> : null}
            </span>
          )
          if (!onSelect) return <div key={verdict} className={TILE}>{body}</div>
          const pressed = selected === verdict
          return (
            <button
              key={verdict}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSelect(verdict)}
              className={cn(TILE, "outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none", pressed ? SPOTLIT : RECEDED)}
            >
              {body}
            </button>
          )
        })}
      </div>
    </div>
  )
}
