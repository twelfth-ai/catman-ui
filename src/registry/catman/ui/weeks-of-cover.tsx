import { cn } from "@/lib/utils"
import { formatWeeks } from "@/registry/catman/lib/retail-format"
import type { MarketSide } from "@/registry/catman/ui/market-side"

/**
 * How many weeks the stock on hand lasts at the current rate of sale, against
 * the band the buyer wants it in. Under the band is a stockout risk, over it is
 * cash sat on a shelf; both are exposed, and the words say which.
 *
 * `weeks` is saleable units ÷ weekly rate of sale, or null when nothing sold
 * (cover is unbounded, which is its own kind of problem).
 *
 * Part of the twelfth catman registry (`@twelfth/weeks-of-cover`).
 */
export type CoverState = "short" | "healthy" | "over" | "no-sales"

export function coverState(weeks: number | null, { min = 0, max }: { min?: number; max: number }): CoverState {
  if (weeks === null || !Number.isFinite(weeks)) return "no-sales"
  if (weeks < min) return "short"
  if (weeks > max) return "over"
  return "healthy"
}

const SIDE: Record<CoverState, MarketSide> = { short: "exposed", healthy: "favourable", over: "exposed", "no-sales": "unknown" }

const MARKER: Record<MarketSide, string> = {
  favourable: "bg-favourable-foreground",
  exposed: "bg-exposed-foreground",
  level: "bg-foreground",
  unknown: "bg-muted-foreground",
}

function stateLabel(state: CoverState, weeks: number | null, min: number, max: number): string {
  if (state === "no-sales" || weeks === null) return "No net sales"
  if (state === "short") return `${formatWeeks(min - weeks)} short`
  if (state === "over") return `${formatWeeks(weeks - max)} over`
  return "In band"
}

export function WeeksOfCover({
  weeks,
  min = 0,
  max,
  scale,
  showState = true,
  className,
}: {
  weeks: number | null
  /** Bottom of the healthy band, e.g. lead time plus safety stock. */
  min?: number
  /** Top of the healthy band; beyond it the stock is aged cash. */
  max: number
  /** Weeks the track spans. Defaults to half again past the band. */
  scale?: number
  /** Say "4 wks over" beside the figure. Off for a dense table cell. */
  showState?: boolean
  className?: string
}) {
  const state = coverState(weeks, { min, max })
  const side = SIDE[state]
  const span = Math.max(scale ?? max * 1.5, max)
  const at = (value: number) => `${(Math.min(Math.max(value, 0), span) / span) * 100}%`
  const clipped = weeks !== null && weeks > span
  const label = stateLabel(state, weeks, min, max)
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs tabular-nums", className)}>
      <span
        role="meter"
        aria-label={weeks === null ? "Weeks of cover: no net sales" : `Weeks of cover: ${formatWeeks(weeks)}, band ${min} to ${max} weeks, ${label}`}
        aria-valuemin={0}
        aria-valuemax={span}
        aria-valuenow={weeks === null ? undefined : Math.min(weeks, span)}
        className="relative h-1.5 w-20 shrink-0 rounded-full bg-muted"
      >
        <span aria-hidden className="absolute inset-y-0 rounded-full bg-favourable" style={{ left: at(min), width: `calc(${at(max)} - ${at(min)})` }} />
        {weeks !== null ? (
          <span
            aria-hidden
            className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background", MARKER[side])}
            style={{ left: at(weeks) }}
          />
        ) : null}
      </span>
      {weeks === null ? <span className="text-muted-foreground">No net sales</span> : <span className="font-mono text-foreground">{`${clipped ? "›" : ""}${formatWeeks(weeks)}`}</span>}
      {showState && weeks !== null ? <span className={cn(state === "healthy" ? "text-favourable-foreground" : "text-exposed-foreground")}>{label}</span> : null}
    </span>
  )
}
