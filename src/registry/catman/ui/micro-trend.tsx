"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

/**
 * A small inline chart of one or more lines over time, for a table cell or a
 * tile: sales against forecast, this year against last, stock against the
 * reorder point, sell-through against plan.
 *
 * - A gap in the data is left blank, never joined: a missing sample is not a
 *   flat line.
 * - A forecast reads as a forecast: a dashed series, a shaded band between two
 *   series (P10 to P90), and a marker where actuals stop.
 * - Hover (or focus and use the arrow keys) to read any sample: a crosshair
 *   glides to it, the other samples dim, and a tooltip reads every series.
 * - Lines draw in on mount; reduced motion skips it.
 * - `footer` sits under the chart, for a change indicator and a figure or two
 *   (see `@twelfth/micro-stat`).
 *
 * Part of the twelfth catman registry (`@twelfth/micro-trend`).
 */
export type MicroTrendSeries = {
  key: string
  label: string
  /** Any CSS colour. Defaults run through a palette that reads in light and dark. */
  color?: string
  /** Stroke width; the most important series is usually drawn heavier. */
  weight?: number
  /** Dashed, for a projection or a forecast. */
  dashed?: boolean
}

/** A shaded range between two value keys, e.g. a forecast's P10 and P90. */
export type MicroTrendBand = {
  lower: string
  upper: string
  label: string
  color?: string
}

/** A vertical marker, e.g. "this week" between actuals and forecast. */
export type MicroTrendMarker = {
  at: string | number | Date
  label: string
}

export type MicroTrendPoint = {
  at: string | number | Date
  values: Record<string, number | null>
}

export type MicroTrendReference = {
  value: number
  label?: string
  tone?: "favourable" | "exposed" | "muted"
}

const PALETTE = ["#f43f5e", "#f59e0b", "#14b8a6", "#6366f1", "#64748b"]
const REFERENCE_STROKE: Record<NonNullable<MicroTrendReference["tone"]>, string> = {
  favourable: "stroke-favourable-foreground",
  exposed: "stroke-exposed-foreground",
  muted: "stroke-muted-foreground",
}
const AT = new Intl.DateTimeFormat("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION)
      query.addEventListener("change", onChange)
      return () => query.removeEventListener("change", onChange)
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  )
}

type Coord = { point: MicroTrendPoint; time: number }

/** Polyline point strings for one series, split at a null or a long silence. */
function segments(coords: Coord[], key: string, gapAfter: number | undefined, x: (t: number) => number, y: (v: number) => number) {
  const out: string[] = []
  let path = ""
  let previous: number | null = null
  for (const { point, time } of coords) {
    const value = point.values[key]
    const broken = value === null || value === undefined || !Number.isFinite(value)
    if (broken || (previous !== null && gapAfter !== undefined && time - previous > gapAfter)) {
      if (path) out.push(path)
      path = ""
    }
    if (!broken) path += `${path ? " " : ""}${x(time).toFixed(1)},${y(value).toFixed(1)}`
    previous = time
  }
  if (path) out.push(path)
  return out
}

/** Closed polygons for a band, split wherever either edge is missing. */
function bandPolygons(coords: Coord[], band: MicroTrendBand, x: (t: number) => number, y: (v: number) => number) {
  const out: string[] = []
  let run: Array<[number, number, number]> = []
  const flush = () => {
    if (run.length > 1) {
      const top = run.map(([t, , hi]) => `${x(t).toFixed(1)},${y(hi).toFixed(1)}`)
      const bottom = [...run].reverse().map(([t, lo]) => `${x(t).toFixed(1)},${y(lo).toFixed(1)}`)
      out.push([...top, ...bottom].join(" "))
    }
    run = []
  }
  for (const { point, time } of coords) {
    const lo = point.values[band.lower]
    const hi = point.values[band.upper]
    if (typeof lo === "number" && typeof hi === "number" && Number.isFinite(lo) && Number.isFinite(hi)) run.push([time, lo, hi])
    else flush()
  }
  flush()
  return out
}

export function MicroTrend({
  points,
  series,
  label,
  width = 120,
  height = 34,
  domain,
  zeroBased = false,
  range,
  reference,
  bands = [],
  marker,
  gapAfter,
  formatValue = (value) => value.toLocaleString("en-AU", { maximumFractionDigits: 1 }),
  formatAt = (date) => AT.format(date),
  readout,
  footer,
  onExpand,
  axes = true,
  align = "end",
  className,
}: {
  points: MicroTrendPoint[]
  series: MicroTrendSeries[]
  /** What the chart shows, for screen readers and the tooltip. */
  label: string
  width?: number
  height?: number
  /** The value axis. Defaults to the lowest value up to the highest, references and bands included. */
  domain?: [number, number]
  /** Start the default axis at zero, for a quantity whose distance from zero is the point. */
  zeroBased?: boolean
  /** The time axis. Defaults to the first sample to the last. */
  range?: [Date | number, Date | number]
  /** A dashed line to read against: a target, a reorder point, parity. */
  reference?: MicroTrendReference
  /** Shaded ranges between two keys, e.g. a forecast's P10 to P90. */
  bands?: MicroTrendBand[]
  /** A vertical line at a moment, e.g. where actuals stop and forecast starts. */
  marker?: MicroTrendMarker
  /** Break a line where two samples are further apart than this many milliseconds. */
  gapAfter?: number
  formatValue?: (value: number, series: MicroTrendSeries) => string
  formatAt?: (date: Date) => string
  /** Extra lines for the tooltip, for the sample under the cursor. */
  readout?: (point: MicroTrendPoint) => ReactNode
  /** Under the chart: a change indicator and a figure or two. */
  footer?: ReactNode
  /** Makes the chart a button, e.g. to open a full-size view. */
  onExpand?: () => void
  /** A faint left edge and baseline, so the lines read as a size and a direction. */
  axes?: boolean
  align?: "start" | "end"
  className?: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)

  const coords: Coord[] = points
    .map((point) => ({ point, time: new Date(point.at).getTime() }))
    .filter(({ time }) => Number.isFinite(time))
    .sort((a, b) => a.time - b.time)

  // Lines draw in once, on mount.
  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !svgRef.current) return
    const easing = "cubic-bezier(0.22, 1, 0.36, 1)"
    for (const line of svgRef.current.querySelectorAll<SVGPolylineElement>("polyline[data-series]")) {
      if (line.dataset.dashed) line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 350, easing, fill: "backwards" })
      else line.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 700, easing })
    }
    for (const area of svgRef.current.querySelectorAll<SVGPolygonElement>("polygon[data-band]")) {
      area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 250, easing, fill: "backwards" })
    }
  }, [])

  if (coords.length < 2) return <span className={cn("text-xs text-muted-foreground", className)}>collecting</span>

  const colored = series.map((s, i) => ({ ...s, color: s.color ?? PALETTE[i % PALETTE.length], weight: s.weight ?? (i === 0 ? 1.6 : 1.3) }))
  const start = range ? new Date(range[0]).getTime() : coords[0].time
  const end = range ? new Date(range[1]).getTime() : coords[coords.length - 1].time
  const values = coords.flatMap(({ point }) => colored.map((s) => point.values[s.key]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)))
  for (const band of bands) for (const { point } of coords) for (const key of [band.lower, band.upper]) {
    const value = point.values[key]
    if (typeof value === "number" && Number.isFinite(value)) values.push(value)
  }
  if (reference) values.push(reference.value)
  const [lo, hi] = domain ?? (() => {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const slack = (max - min) * 0.08
    return [zeroBased ? Math.min(0, min) : min - slack, max + slack]
  })()
  const pad = 2
  const x = (time: number) => (end === start ? width / 2 : ((time - start) / (end - start)) * width)
  const y = (value: number) => {
    const clamped = Math.min(Math.max(value, lo), hi)
    return hi === lo ? height / 2 : height - pad - ((clamped - lo) / (hi - lo)) * (height - 2 * pad)
  }

  const active = coords[hover ?? coords.length - 1]
  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect()
    if (!box?.width) return coords.length - 1
    const at = ((clientX - box.left) / box.width) * width
    let best = 0
    for (let i = 1; i < coords.length; i++) if (Math.abs(x(coords[i].time) - at) < Math.abs(x(coords[best].time) - at)) best = i
    return best
  }
  const onPointerMove = (event: PointerEvent) => setHover(nearest(event.clientX))
  const onKeyDown = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const current = hover ?? coords.length - 1
    setHover(event.key === "Home" ? 0 : event.key === "End" ? coords.length - 1 : Math.max(0, Math.min(coords.length - 1, current + (event.key === "ArrowLeft" ? -1 : 1))))
  }
  const latest = coords[coords.length - 1].point
  const summary = colored.map((s) => {
    const value = latest.values[s.key]
    return `${s.label} ${value === null || value === undefined ? "no value" : formatValue(value, s)}`
  }).join(", ")

  const chart = (
    <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden className="block overflow-visible" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
      {axes ? <polyline points={`0.5,0 0.5,${height - 0.5} ${width},${height - 0.5}`} fill="none" stroke="currentColor" strokeOpacity={0.16} strokeWidth={1} pointerEvents="none" /> : null}
      {bands.map((band, b) =>
        bandPolygons(coords, band, x, y).map((polygon, index) => (
          <polygon key={`band-${b}-${index}`} data-band points={polygon} fill={band.color ?? colored[0]?.color ?? PALETTE[0]} fillOpacity={0.2} className="transition-opacity duration-200" opacity={hover === null ? 1 : 0.7} />
        )),
      )}
      {marker ? (
        <line x1={x(new Date(marker.at).getTime())} x2={x(new Date(marker.at).getTime())} y1={0} y2={height} stroke="currentColor" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 2" />
      ) : null}
      {reference ? (
        <line x1={0} x2={width} y1={y(reference.value)} y2={y(reference.value)} className={REFERENCE_STROKE[reference.tone ?? "muted"]} strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" />
      ) : null}
      {colored.map((s) =>
        segments(coords, s.key, gapAfter, x, y).map((segment, index) =>
          segment.includes(" ") ? (
            <polyline
              key={`${s.key}-${index}`}
              data-series={s.key}
              data-dashed={s.dashed ? "" : undefined}
              points={segment}
              pathLength={s.dashed ? undefined : 1}
              strokeDasharray={s.dashed ? "3 2" : reducedMotion ? undefined : 1}
              fill="none"
              stroke={s.color}
              strokeWidth={s.weight}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-opacity duration-200"
              opacity={hover === null ? 1 : 0.5}
            />
          ) : (
            <circle key={`${s.key}-${index}`} cx={segment.split(",")[0]} cy={segment.split(",")[1]} r={1.2} fill={s.color} />
          ),
        ),
      )}
      {/* The crosshair and its dots glide between samples rather than jump. */}
      <g
        pointerEvents="none"
        className={cn("transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none", hover === null ? "opacity-0" : "opacity-100")}
        style={{ transform: `translateX(${x(active.time)}px)` }}
      >
        <line x1={0} x2={0} y1={0} y2={height} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
      </g>
      {colored.map((s) => {
        const value = active.point.values[s.key]
        if (value === null || value === undefined || !Number.isFinite(value)) return null
        return (
          <g
            key={s.key}
            pointerEvents="none"
            className={cn("transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none", hover === null ? "opacity-0" : "opacity-100")}
            style={{ transform: `translate(${x(active.time)}px, ${y(value)}px)` }}
          >
            <circle r={2.6} fill={s.color} stroke="var(--background)" strokeWidth={1} />
          </g>
        )
      })}
      {/* Transparent hit area, so the space between lines still tracks. */}
      <rect width={width} height={height} fill="transparent" />
    </svg>
  )

  return (
    <span className={cn("inline-flex flex-col gap-0.5", align === "end" ? "items-end" : "items-start", className)}>
      <Tooltip trackCursorAxis="x">
        <TooltipTrigger
          delay={0}
          render={<button type="button" />}
          aria-label={`${label}: ${summary}. Use left and right arrows to move between samples.${onExpand ? " Click to expand." : ""}`}
          onClick={onExpand}
          onKeyDown={onKeyDown}
          onBlur={() => setHover(null)}
          className={cn("inline-flex rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring", onExpand ? "cursor-zoom-in" : "cursor-crosshair")}
        >
          {chart}
        </TooltipTrigger>
        <TooltipContent side="top" className="block w-52 py-2 text-left text-xs">
          <p className="font-medium tabular-nums">{formatAt(new Date(active.time))}</p>
          <div className="mt-1.5 space-y-0.5 tabular-nums">
            {colored.filter((s) => active.point.values[s.key] != null || colored.every((c) => active.point.values[c.key] == null)).map((s) => {
              const value = active.point.values[s.key]
              return (
                <p key={s.key} className="flex items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="opacity-80">{s.label}</span>
                  <span className="ml-auto font-medium">{value === null || value === undefined ? "—" : formatValue(value, s)}</span>
                </p>
              )
            })}
          </div>
          {bands.map((band) => {
            const lo = active.point.values[band.lower]
            const hi = active.point.values[band.upper]
            if (typeof lo !== "number" || typeof hi !== "number") return null
            const s0 = colored[0]
            return <p key={band.label} className="mt-1 tabular-nums opacity-80">{band.label}: {formatValue(lo, s0)}–{formatValue(hi, s0)}</p>
          })}
          {marker && active.time >= new Date(marker.at).getTime() && colored.some((s) => s.dashed && active.point.values[s.key] != null) ? <p className="mt-1 opacity-70">{marker.label} onward is forecast</p> : null}
          {reference?.label ? <p className="mt-1.5 opacity-70">Reference: {reference.label}</p> : null}
          {readout ? <div className="mt-1.5 opacity-80">{readout(active.point)}</div> : null}
          {onExpand ? <p className="mt-1.5 text-[10px] opacity-60">Click to expand</p> : null}
        </TooltipContent>
      </Tooltip>
      {footer ? <span className="flex items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">{footer}</span> : null}
    </span>
  )
}
