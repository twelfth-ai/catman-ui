"use client"

import { useState, type KeyboardEvent, type PointerEvent } from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { useOneOpen } from "@/registry/catman/lib/one-open"
import { formatMarketPosition } from "@/registry/catman/lib/retail-format"

/**
 * Weeks of price position against the market, as a small line with a dashed
 * parity line. Hover, or focus and use the arrow keys, to read any week.
 *
 * The y domain is symmetric around zero so parity is always the middle and
 * "above" is always up. A week with no figure breaks the line rather than
 * being joined across: a gap is not a straight run.
 *
 * Part of the twelfth catman registry (`@twelfth/price-trend`).
 */
export type PriceTrendPoint = {
  /** ISO date the week starts, e.g. "2026-10-05". */
  week: string
  /** Ours vs theirs, in percent; null when too few prices compared that week. */
  positionPct: number | null
}

const PAD = 2
const SMOOTHING = 0.12
const weekDate = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const figure = (value: number) => value.toLocaleString("en-AU", { maximumFractionDigits: 1 })

function weekLabel(week: string) {
  const at = /^\d{4}-\d{2}-\d{2}$/.test(week) ? new Date(`${week}T12:00:00Z`) : null
  return at && Number.isFinite(at.getTime()) ? `Week of ${weekDate.format(at)}` : week
}

function linePath(points: Array<[number, number]>, smooth: boolean) {
  if (points.length === 0) return ""
  if (!smooth || points.length < 3) return points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join("")

  let path = `M${points[0][0]} ${points[0][1]}`
  for (let i = 0; i < points.length - 1; i += 1) {
    const previous = points[i - 1] ?? points[i]
    const current = points[i]
    const next = points[i + 1]
    const following = points[i + 2] ?? next
    const low = Math.min(current[1], next[1])
    const high = Math.max(current[1], next[1])
    const control1 = [
      current[0] + (next[0] - previous[0]) * SMOOTHING,
      Math.max(low, Math.min(high, current[1] + (next[1] - previous[1]) * SMOOTHING)),
    ]
    const control2 = [
      next[0] - (following[0] - current[0]) * SMOOTHING,
      Math.max(low, Math.min(high, next[1] - (following[1] - current[1]) * SMOOTHING)),
    ]
    path += `C${control1[0]} ${control1[1]} ${control2[0]} ${control2[1]} ${next[0]} ${next[1]}`
  }
  return path
}

export function PriceTrend({
  points,
  label,
  against = "the market",
  width = 96,
  height = 28,
  inverse = false,
  axes = true,
  smooth = true,
  className,
}: {
  points: PriceTrendPoint[]
  /** What the line is, e.g. "Position vs market" or "vs JB Hi-Fi". */
  label: string
  /** Who the comparison is against, in the explainer. */
  against?: string
  width?: number
  height?: number
  /** Drawn on a dark tile: the line takes the tile's own text colour. */
  inverse?: boolean
  /** A faint left edge and baseline, so the line reads as a size and a direction. */
  axes?: boolean
  /** Gently rounds joins without overshooting the values. */
  smooth?: boolean
  className?: string
}) {
  const [open, setOpen] = useOneOpen()
  const [selected, setSelected] = useState(points.length - 1)
  const active = Math.max(0, Math.min(points.length - 1, selected))
  const point = points[active]
  const previous = points[active - 1]?.positionPct
  const change = point?.positionPct != null && previous != null ? point.positionPct - previous : null
  const known = points.flatMap((p) => (p.positionPct === null ? [] : [Math.abs(p.positionPct)]))
  const extent = Math.max(2, ...known)
  const x = (i: number) => (points.length < 2 ? width / 2 : PAD + (i * (width - 2 * PAD)) / (points.length - 1))
  const y = (value: number) => height / 2 - (value / extent) * (height / 2 - PAD)
  const fmt = (n: number) => Number(n.toFixed(1))

  const runs: Array<Array<[number, number]>> = []
  const lone: Array<[number, number]> = []
  points.forEach((p, i) => {
    if (p.positionPct === null) {
      return
    }
    const px = fmt(x(i))
    const py = fmt(y(p.positionPct))
    if (i === 0 || points[i - 1]?.positionPct === null) runs.push([])
    runs.at(-1)?.push([px, py])
  })
  runs.forEach((run) => { if (run.length === 1) lone.push(run[0]) })
  const path = runs.map((run) => linePath(run, smooth)).join("")

  const first = points[0]?.positionPct ?? null
  const last = points.at(-1)?.positionPct ?? null
  const zero = fmt(y(0))
  const chart = (
    <svg
      role="img"
      aria-label={`${label}: ${formatMarketPosition(first)} ${points.length} weeks ago, ${formatMarketPosition(last)} last week`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("block", inverse ? "text-current" : "text-foreground/80", className)}
    >
      {axes ? <polyline points={`0.5,0 0.5,${height - 0.5} ${width},${height - 0.5}`} fill="none" stroke="currentColor" strokeOpacity={inverse ? 0.3 : 0.16} strokeWidth={1} /> : null}
      <line x1={0} x2={width} y1={zero} y2={zero} stroke="currentColor" strokeOpacity={inverse ? 0.4 : 0.28} strokeDasharray="2 2" strokeWidth={1} />
      {path && <path d={path} fill="none" className="stroke-current" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />}
      {lone.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} className="fill-current" />
      ))}
      {open && point ? <>
        <line data-trend-cursor x1={x(active)} x2={x(active)} y1={0} y2={height} className="stroke-muted-foreground" strokeWidth={1} />
        {point.positionPct !== null ? <circle cx={x(active)} cy={y(point.positionPct)} r={2.5} className="fill-popover stroke-current" strokeWidth={1.5} /> : null}
      </> : null}
    </svg>
  )

  const inspect = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.querySelector("svg")?.getBoundingClientRect()
    if (!bounds?.width || points.length === 0) return
    const ratio = ((event.clientX - bounds.left) / bounds.width * width - PAD) / (width - PAD * 2)
    setSelected(Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1)))))
  }
  const navigate = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    setOpen(true)
    setSelected(event.key === "Home" ? 0 : event.key === "End" ? points.length - 1 : Math.max(0, Math.min(points.length - 1, active + (event.key === "ArrowLeft" ? -1 : 1))))
  }
  if (points.length === 0) return chart

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={0}
        closeDelay={60}
        aria-label={`Inspect ${label} price history. Use left and right arrows to move between weeks.`}
        onPointerMove={inspect}
        onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setOpen(true) }}
        onKeyDown={navigate}
        className="-my-1 inline-flex cursor-crosshair items-center rounded-sm p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >{chart}</PopoverTrigger>
      <PopoverContent side="top" align="center" sideOffset={8} initialFocus={false} finalFocus={false} className="w-80 max-w-[calc(100vw-2rem)] p-3 text-xs">
        {/* One child: stock popovers stack their children with a gap. */}
        <div>
          <div className="truncate font-medium text-popover-foreground">{label}</div>
          <div aria-live="polite" aria-atomic="true">
            <p className="mt-0.5 text-muted-foreground">{point ? weekLabel(point.week) : "No weekly history"}</p>
            <div className="mt-2 min-h-[4.75rem]">
              {point?.positionPct != null ? <>
                <p className="truncate text-base font-semibold tabular-nums">{point.positionPct === 0 ? "At parity" : `${figure(Math.abs(point.positionPct))}% ${point.positionPct > 0 ? "above" : "below"} comparison price`}</p>
                <div className="mt-2 flex items-baseline justify-between gap-3 border-t pt-2">
                  <span className="text-muted-foreground">Price index</span><span className="font-mono tabular-nums">{figure(100 + point.positionPct)}</span>
                </div>
                {change !== null ? <p className="mt-1 truncate text-muted-foreground">{change > 0 ? "+" : change < 0 ? "−" : ""}{figure(Math.abs(change))} percentage points vs previous week</p> : <p className="mt-1 text-muted-foreground">No previous-week comparison</p>}
              </> : <p className="text-muted-foreground">Not enough comparable prices for this week.</p>}
            </div>
            <p className="mt-2 border-t pt-2 text-muted-foreground">Our prices relative to {against}. The dashed line is parity (index 100).</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
