"use client"

import type { ReactNode } from "react"
import { MinusIcon } from "lucide-react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useOneOpen } from "@/registry/catman/lib/one-open"
import { formatIndex, formatPosition, formatUnits } from "@/registry/catman/lib/retail-format"
import { MarketArrow, marketSideFromPosition, marketToneClass } from "@/registry/catman/ui/market-side"

/**
 * Where our prices sit against a competitor's: "12% above", "4% below", "In
 * line". The position is the median gap across comparable lines, in percent,
 * ours vs theirs; null when there are too few matched lines to say.
 *
 * Part of the Twelfth catman registry (`@twelfth/price-position`).
 */
export const positionLabel = formatPosition

const CHIP = "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs tabular-nums"

function chipTone(positionPct: number | null) {
  const side = marketSideFromPosition(positionPct)
  return { side, className: cn(marketToneClass[side], (side === "level" || side === "unknown") && "bg-secondary") }
}

function ChipFace({ positionPct }: { positionPct: number | null }) {
  const { side } = chipTone(positionPct)
  return (
    <>
      {side === "level" ? <MinusIcon aria-hidden className="size-3" /> : side === "unknown" ? null : <MarketArrow side={side} pointing="ours" className="size-3" />}
      <span>{positionLabel(positionPct)}</span>
    </>
  )
}

/** The chip alone, for a table cell or an inline mention. */
export function PricePositionChip({ positionPct, className }: { positionPct: number | null; className?: string }) {
  return (
    <span className={cn(CHIP, chipTone(positionPct).className, className)}>
      <ChipFace positionPct={positionPct} />
    </span>
  )
}

export type PricePositionEvidence = {
  /** Lines matched to the competitor in the period. */
  matched: number
  /** Of those, how many we price above. */
  above: number
  /** And below. */
  below: number
}

/**
 * The chip with the evidence behind it on hover or focus: the index, how many
 * lines it rests on, and which way they split. A position without its count is
 * a number nobody can argue with, which is the wrong kind of number.
 */
export function PricePositionBadge({
  competitor,
  positionPct,
  evidence,
  period,
  channel,
  action,
  className,
}: {
  competitor: string
  positionPct: number | null
  evidence: PricePositionEvidence
  /** e.g. "8-week comparison" or "Last observed prices". */
  period?: string
  /** e.g. "Direct retail" or "Marketplace sellers". */
  channel?: string
  /** A link or button under the evidence, e.g. to the matched lines. */
  action?: ReactNode
  className?: string
}) {
  const label = positionLabel(positionPct)
  const subtitle = [period, channel].filter(Boolean).join(" · ")
  const [open, setOpen] = useOneOpen()
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={40}
        closeDelay={80}
        aria-label={`Our price position against ${competitor}: ${label}`}
        className={cn(CHIP, "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", chipTone(positionPct).className, className)}
      >
        <ChipFace positionPct={positionPct} />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={7} className="w-72 max-w-[calc(100vw-2rem)] p-3 text-xs">
        {/* One child: stock popovers stack their children with a gap. */}
        <div>
          <p className="font-medium text-popover-foreground">Our prices vs {competitor}</p>
          {subtitle ? <p className="mt-0.5 text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="text-base font-semibold">{label}</span>
            {positionPct !== null ? <span className="font-mono tabular-nums text-muted-foreground">Index {formatIndex(positionPct)}</span> : null}
        </div>
        <dl className="mt-3 space-y-1.5 border-y py-2.5">
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Matched lines</dt><dd className="font-mono tabular-nums">{formatUnits(evidence.matched)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Our lines priced above</dt><dd className="font-mono tabular-nums">{formatUnits(evidence.above)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Our lines priced below</dt><dd className="font-mono tabular-nums">{formatUnits(evidence.below)}</dd></div>
        </dl>
        <p className="mt-2 text-muted-foreground">{positionPct === null ? "Not enough comparable prices for a position in this period." : "The median price gap across comparable lines. Index 100 is parity; above 100 means our prices are higher."}</p>
        {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
