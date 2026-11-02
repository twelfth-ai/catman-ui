"use client"

import { useState, type PointerEvent } from "react"

import { cn } from "@/lib/utils"
import { formatUnits } from "@/registry/catman/lib/retail-format"

/**
 * A price band as a picture: how far from the market price a line can sit,
 * across our shelf prices, before it reads as priced above or below market.
 * Shelf price runs left to right on a log scale; the gap to market runs up
 * (we're dearer) and down (we're cheaper). The plain middle is in line; the
 * tinted top and bottom are above and below market. A dollar limit narrows the
 * middle as the price grows; a price tier steps it.
 *
 * It prints no wording for the band itself ("±10% under $500"): that is the
 * caller's, beside the picture, so there is one source for how a band reads.
 *
 * Part of the twelfth catman registry (`@twelfth/price-band`). The zones read
 * the `favourable` and `exposed` colour tokens installed by market-side.
 */

/** One tier: in line from `belowPct` under to `abovePct` over market, each side optionally capped at a dollar gap. */
export type PriceBandTier = { abovePct: number; belowPct: number; aboveAmount?: number; belowAmount?: number }

/** The band from $0, then any tiers that take over from a higher shelf price. */
export type PriceBandShape = PriceBandTier & { tiers?: Array<PriceBandTier & { fromPrice: number }> }

export type PriceBandLineCounts = { below: number; inLine: number; above: number }

export type PriceBandLabels = {
  /** The top zone. */
  above: string
  /** The bottom zone. */
  below: string
  /** The middle. */
  inLine: string
  /** The zero line, on the gap scale. */
  market: string
  /** The shelf-price axis. */
  axis: string
  /** What the picture shows, for a screen reader. */
  description: string
}

const DEFAULT_LABELS: PriceBandLabels = {
  above: "Above market",
  below: "Below market",
  inLine: "In line",
  market: "Market",
  axis: "Shelf $",
  description: "Price band by shelf price: lines within it read as in line with market; further above, as priced above market; further below, as priced below market.",
}

type Tier = PriceBandTier & { fromPrice: number }

const cents = (dollars: number) => Math.round(dollars * 100)

/** The tiers in force from $0, cheapest first. */
function tierList(band: PriceBandShape): Tier[] {
  return [{ ...band, fromPrice: 0 }, ...(band.tiers ?? [])]
}

/** The tier a line at shelf price `price` takes: the last whose from-price is at or below it. */
function tierAt(tiers: Tier[], price: number): Tier {
  let chosen = tiers[0]!
  for (const tier of tiers) if (cents(tier.fromPrice) <= cents(price)) chosen = tier
  return chosen
}

/** The in-line gap at a shelf price, in percent of the market price: up to `above` over, `below` under. A side's
 * dollar limit, when it is the lower of the two, sets that side. */
function priceBandAt(band: PriceBandShape, price: number): { above: number; below: number } {
  const tier = tierAt(tierList(band), price)
  const above = tier.aboveAmount !== undefined && price > tier.aboveAmount ? Math.min(tier.abovePct, (100 * tier.aboveAmount) / (price - tier.aboveAmount)) : tier.abovePct
  const below = tier.belowAmount !== undefined ? Math.min(tier.belowPct, (100 * tier.belowAmount) / (price + tier.belowAmount)) : tier.belowPct
  return { above, below }
}

/** The shelf prices worth drawing: whole decades around every tier start and every price a dollar limit starts to bite. */
function priceDomain(band: PriceBandShape): [number, number] {
  const points = [100]
  for (const tier of tierList(band)) {
    if (tier.fromPrice > 0) points.push(tier.fromPrice)
    if (tier.aboveAmount !== undefined && tier.abovePct > 0) points.push(tier.aboveAmount * (1 + 100 / tier.abovePct))
    if (tier.belowAmount !== undefined && tier.belowPct > 0 && tier.belowPct < 100) points.push(tier.belowAmount * (100 / tier.belowPct - 1))
  }
  const lo = Math.max(1, 10 ** Math.floor(Math.log10(Math.min(...points) / 4)))
  const hi = Math.min(1_000_000, 10 ** Math.ceil(Math.log10(Math.max(...points) * 4)))
  return [lo, hi]
}

const SAMPLES = 96

/** The plot's half-height in percent of gap: a round scale value at or above `gap`, never under 4%. */
function niceSpan(gap: number): number {
  return [4, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100].find((step) => step >= gap) ?? 100
}

type Geometry = {
  lo: number
  hi: number
  /** Half the plot's height, in percent of gap. */
  span: number
  upper: string
  lower: string
  within: string
  starts: number[]
}

/** The plot in a 100 × 100 box: x is the share of the log price range, y runs from +span (0) to −span (100). */
function geometry(band: PriceBandShape): Geometry {
  const [lo, hi] = priceDomain(band)
  const starts = (band.tiers ?? []).map((tier) => tier.fromPrice).filter((price) => price > lo && price < hi)
  const prices: number[] = []
  for (let index = 0; index <= SAMPLES; index++) prices.push(lo * (hi / lo) ** (index / SAMPLES))
  // A tier steps the band at its from-price: draw both sides of the step.
  for (const start of starts) prices.push(start - 0.01, start)
  prices.sort((a, b) => a - b)
  const sides = prices.map((price) => ({ price, ...priceBandAt(band, price) }))
  const maxAbove = Math.max(...sides.map((side) => side.above))
  const maxBelow = Math.max(...sides.map((side) => side.below))
  const span = niceSpan(Math.max(maxAbove, maxBelow) * 2)
  const x = (price: number) => (100 * Math.log(price / lo)) / Math.log(hi / lo)
  const y = (gap: number) => 50 - (50 * gap) / span
  const top = sides.map((side) => `${x(side.price).toFixed(2)},${y(side.above).toFixed(2)}`)
  const bottom = sides.map((side) => `${x(side.price).toFixed(2)},${y(-side.below).toFixed(2)}`)
  return {
    lo,
    hi,
    span,
    upper: `M${top.join("L")}`,
    lower: `M${bottom.join("L")}`,
    within: `M${top.join("L")}L${[...bottom].reverse().join("L")}Z`,
    starts,
  }
}

const logShare = (price: number, lo: number, hi: number) => (100 * Math.log(price / lo)) / Math.log(hi / lo)

/** "$10", "$1k", "$10k", "$1m" for a decade tick. */
const decadeText = (price: number) => (price >= 1_000_000 ? `$${price / 1_000_000}m` : price >= 1000 ? `$${price / 1000}k` : `$${price}`)

/** "5%", "4.8%", "0.5%". */
const pctText = (value: number) => `${Number(value.toFixed(1))}%`

const snapPrice = (price: number) => (price >= 10 ? Math.round(price) : Math.round(price * 100) / 100)

/** "$250", "$2,500"; to the cent only below $10. */
function priceText(price: number): string {
  const total = cents(snapPrice(price))
  const whole = String(Math.trunc(total / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  const part = total % 100
  return part === 0 ? `$${whole}` : `$${whole}.${String(part).padStart(2, "0")}`
}

function Zones({ shape, hoverX }: { shape: Geometry; hoverX?: number | null }) {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <rect x={0} y={0} width={100} height={50} className="fill-exposed" />
      <rect x={0} y={50} width={100} height={50} className="fill-favourable" />
      <path d={shape.within} className="fill-background" />
      <line x1={0} x2={100} y1={50} y2={50} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" className="stroke-border" />
      {shape.starts.map((start) => {
        const x = logShare(start, shape.lo, shape.hi)
        return <line key={start} x1={x} x2={x} y1={0} y2={100} strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" className="stroke-border" />
      })}
      <path d={shape.upper} fill="none" strokeWidth={1.25} vectorEffect="non-scaling-stroke" className="stroke-muted-foreground/80" />
      <path d={shape.lower} fill="none" strokeWidth={1.25} vectorEffect="non-scaling-stroke" className="stroke-muted-foreground/80" />
      {hoverX != null ? <line x1={hoverX} x2={hoverX} y1={0} y2={100} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-foreground/90" /> : null}
    </svg>
  )
}

/** The band, drawn: the zones across shelf prices, a readout of the price under the pointer, and, when given, how
 * many lines sit in each zone today. */
export function PriceBandChart({ band, counts, countsNote, labels, className }: {
  band: PriceBandShape
  /** Lines below, in line and above today, shown under the plot while nothing is hovered. */
  counts?: PriceBandLineCounts | null
  /** What the counts cover, before them, e.g. "Your lines now:". */
  countsNote?: string
  /** The chart's own words: zone names, the axis, the screen-reader description. */
  labels?: Partial<PriceBandLabels>
  className?: string
}) {
  const text = { ...DEFAULT_LABELS, ...labels }
  const shape = geometry(band)
  const [hover, setHover] = useState<number | null>(null)
  const decades: number[] = []
  for (let price = shape.lo; price <= shape.hi * 1.0001; price *= 10) decades.push(Math.round(price))
  // A tier start close to a decade (within a sixth of one) takes that decade's place on the axis.
  const shownDecades = decades.filter((decade) => shape.starts.every((start) => Math.abs(Math.log10(start / decade)) > 1 / 6))
  // Snapped to the dollar (the cent under $10) so the readout's price and its market range agree.
  const hoverPrice = hover === null ? null : snapPrice(shape.lo * (shape.hi / shape.lo) ** (hover / 100))
  const readout = hoverPrice === null ? null : priceBandAt(band, hoverPrice)

  function move(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    setHover(Math.min(100, Math.max(0, (100 * (event.clientX - box.left)) / box.width)))
  }

  const gutter = "w-10 shrink-0"
  return (
    <figure className={cn("w-full max-w-xl text-[11px] text-muted-foreground", className)} data-price-band>
      <div className="flex gap-2">
        {/* The gap scale, not the band: the band's own words are the caller's, beside the picture. */}
        <div className={cn(gutter, "relative h-24 text-right tabular-nums")} aria-hidden="true">
          <span className="absolute right-0 top-0">+{shape.span}%</span>
          <span className="absolute right-0 top-1/2 -translate-y-1/2">{text.market}</span>
          <span className="absolute bottom-0 right-0">−{shape.span}%</span>
        </div>
        <div
          role="img"
          aria-label={text.description}
          className="relative h-24 min-w-0 flex-1 touch-none overflow-hidden rounded-sm border"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={() => setHover(null)}
        >
          <Zones shape={shape} hoverX={hover} />
          <span aria-hidden="true" className="absolute right-1.5 top-1 font-medium text-exposed-foreground">{text.above}</span>
          <span aria-hidden="true" className="absolute bottom-1 right-1.5 font-medium text-favourable-foreground">{text.below}</span>
          <span aria-hidden="true" className="absolute left-1.5 top-1/2 -translate-y-1/2 text-foreground">{text.inLine}</span>
        </div>
      </div>
      <div className="mt-1 flex gap-2" aria-hidden="true">
        <span className={cn(gutter, "text-right")}>{text.axis}</span>
        <div className="relative h-4 min-w-0 flex-1 tabular-nums">
          {shownDecades.map((decade) => <AxisTick key={`d${decade}`} at={logShare(decade, shape.lo, shape.hi)}>{decadeText(decade)}</AxisTick>)}
          {shape.starts.map((start) => <AxisTick key={`t${start}`} at={logShare(start, shape.lo, shape.hi)} strong>{priceText(start)}</AxisTick>)}
        </div>
      </div>
      <figcaption className="ml-12 mt-1 min-h-4 tabular-nums" aria-live="polite">
        {hoverPrice !== null && readout ? (
          <span className="text-foreground">
            At {priceText(hoverPrice)}: in line from {pctText(readout.below)} under to {pctText(readout.above)} over market
            <span className="text-muted-foreground"> · market {priceText(hoverPrice / (1 + readout.above / 100))}–{readout.below >= 100 ? "any" : priceText(hoverPrice / (1 - readout.below / 100))}</span>
          </span>
        ) : counts ? <PriceBandCounts counts={counts} note={countsNote} /> : null}
      </figcaption>
    </figure>
  )
}

function AxisTick({ at, strong, children }: { at: number; strong?: boolean; children: string }) {
  // The two ends hug the plot's edges rather than hang past them.
  const shift = at <= 2 ? "translate-x-0" : at >= 98 ? "-translate-x-full" : "-translate-x-1/2"
  return <span className={cn("absolute top-0 whitespace-nowrap", shift, strong && "font-medium text-foreground")} style={{ left: `${at}%` }}>{children}</span>
}

function Swatch({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 rounded-[2px] border", className)} />
}

/** "Your lines now: ■ 30 below · □ 140 in line · ■ 12 above", each swatch its zone's tint. */
export function PriceBandCounts({ counts, note, className }: { counts: PriceBandLineCounts; note?: string; className?: string }) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground", className)}>
      {note !== undefined ? <span>{note}</span> : null}
      <span className="inline-flex items-center gap-1"><Swatch className="bg-favourable" /><span className="text-foreground">{formatUnits(counts.below)}</span> below</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1"><Swatch className="bg-background" /><span className="text-foreground">{formatUnits(counts.inLine)}</span> in line</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1"><Swatch className="bg-exposed" /><span className="text-foreground">{formatUnits(counts.above)}</span> above</span>
    </span>
  )
}

/** The same picture at a table row's size: no axis, no labels. The row's words beside it say the band, so a screen
 * reader skips it. */
export function PriceBandMini({ band, className }: { band: PriceBandShape; className?: string }) {
  const shape = geometry(band)
  return (
    <span aria-hidden="true" className={cn("relative inline-block h-7 w-20 shrink-0 overflow-hidden rounded-[3px] border align-middle", className)} data-price-band-mini>
      <Zones shape={shape} />
    </span>
  )
}
