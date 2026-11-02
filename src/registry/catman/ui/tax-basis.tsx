"use client"

import type { ReactNode } from "react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatMoney, type RetailLocale } from "@/registry/catman/lib/retail-format"

/**
 * Whether a price includes tax, as a badge the price sits inside, so the figure
 * and its basis read as one object. Filled means the tax is in the figure;
 * hollow means it is left out. The shape tells inc from ex at a glance in a
 * mixed column, and the word in it still says which, so neither colour nor
 * shape alone carries meaning. Hover (or focus) explains the tax: its full
 * name, the rate and the same price on the other basis, when those are known.
 *
 * Works for any tax label: GST, VAT, GST/HST and SST print as they are; longer
 * labels ("Sales tax", "Consumption tax") print as "tax" in the mark and in
 * full in its title and screen-reader text.
 *
 * Part of the twelfth catman registry (`@twelfth/tax-basis`).
 */
export type TaxBasis = "inclusive" | "exclusive"

/** How a figure carries its basis. `show`: the figure and its mark. `hide`:
 * the figure alone, for a column whose header already names the basis.
 * `both`: the figure, then the same price on the other basis, each marked. */
export type TaxBasisDisplay = "show" | "hide" | "both"

/** "including GST" / "excluding VAT": what a screen reader hears. */
export function taxBasisWords(basis: TaxBasis, taxLabel = "GST"): string {
  return `${basis === "inclusive" ? "including" : "excluding"} ${taxLabel}`
}

/** The label as the mark prints it: a short single-word label as given, any
 * other as "tax". The full label stays in the title and spoken text. */
function markLabel(taxLabel: string): string {
  return taxLabel.length <= 7 && !/\s/.test(taxLabel) ? taxLabel : "tax"
}

/**
 * The same price on the other basis, at the given rate. Null when the basis or
 * the rate is unknown, or the rate is not a plausible tax rate: a converted
 * figure at a guessed rate is worse than no figure.
 */
export function otherBasisPrice(value: number | null, basis: TaxBasis | null | undefined, taxRatePct: number | null | undefined): number | null {
  if (value === null || !Number.isFinite(value) || !basis) return null
  if (taxRatePct === null || taxRatePct === undefined || !Number.isFinite(taxRatePct) || taxRatePct < 0 || taxRatePct > 30) return null
  const factor = 1 + taxRatePct / 100
  return basis === "exclusive" ? value * factor : value / factor
}

/** The full name behind a short label, for the hover. Labels that are already
 * words ("Sales tax") explain themselves. */
const TAX_NAMES: Record<string, string> = {
  GST: "Goods and Services Tax",
  VAT: "Value Added Tax",
  "GST/HST": "Goods and Services Tax / Harmonized Sales Tax",
  HST: "Harmonized Sales Tax",
  SST: "Sales and Service Tax",
}

/** How the badge explains itself. `focus`: a tooltip on hover and keyboard
 * focus. `hover`: pointer only, for a badge inside a link or button, which
 * must not hold a second focus stop. `false`: none, for a badge already inside
 * a tooltip. The spoken text names the basis in every case. */
export type TaxBasisExplain = "focus" | "hover" | false

const BADGE = "inline-flex shrink-0 items-center gap-1 rounded-[4px] border border-current/35 whitespace-nowrap"
const TAG = "font-mono text-[9.5px] font-medium uppercase leading-[13px] tracking-[0.04em]"
/** Both tones derive from the text colour around them, so the badge reads on a
 * card, in a header and inside a tooltip without a variant. */
const TONE: Record<TaxBasis, string> = {
  inclusive: "bg-current/12",
  exclusive: "",
}

function Explanation({ basis, taxLabel, taxRatePct, other, note }: { basis: TaxBasis; taxLabel: string; taxRatePct?: number | null; other?: string | null; note?: ReactNode }) {
  const name = TAX_NAMES[taxLabel]
  const rate = taxRatePct != null && Number.isFinite(taxRatePct) && taxRatePct >= 0 && taxRatePct <= 30 ? taxRatePct : null
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-medium">{basis === "inclusive" ? `Includes ${taxLabel}` : `Excludes ${taxLabel}`}</span>
      {name ? <span className="opacity-80">{taxLabel}: {name}</span> : null}
      {rate !== null ? <span className="opacity-80 tabular-nums">Rate {rate}%</span> : null}
      {other ? <span className="tabular-nums">{basis === "inclusive" ? "Ex" : "Inc"} {taxLabel}: {other}</span> : null}
      {note ? <span className="opacity-80">{note}</span> : null}
    </span>
  )
}

/**
 * The badge. With `children` (the figure) it holds the price and its basis
 * together; without, it is the basis alone, for a column header or a heading
 * that names it once for every figure under it.
 */
export function TaxBasisMark({
  basis,
  taxLabel = "GST",
  short = false,
  taxRatePct,
  other,
  note,
  explain = "focus",
  children,
  className,
}: {
  basis: TaxBasis
  /** The workspace's word for the tax: "GST", "VAT", "GST/HST", "Sales tax"… */
  taxLabel?: string
  /** "inc" / "ex" only, where width is tight. The hover and spoken text keep the label. */
  short?: boolean
  /** Shown in the hover when known; never assumed. */
  taxRatePct?: number | null
  /** The same price on the other basis, formatted, for the hover. */
  other?: string | null
  /** A further line for the hover, e.g. how the figure was converted. */
  note?: ReactNode
  explain?: TaxBasisExplain
  /** The figure the badge holds. */
  children?: ReactNode
  className?: string
}) {
  const words = taxBasisWords(basis, taxLabel)
  const face = (
    <>
      {children !== undefined ? <span className="tabular-nums">{children}</span> : null}
      <span aria-hidden className={cn(TAG, children !== undefined && "opacity-75")}>{basis === "inclusive" ? "inc" : "ex"}{short ? null : ` ${markLabel(taxLabel)}`}</span>
      <span className="sr-only">{words}</span>
    </>
  )
  const badge = cn(BADGE, TONE[basis], children !== undefined ? "px-1" : "px-[3px]", className)
  if (!explain) return <span data-tax-basis={basis} className={badge}>{face}</span>
  return (
    <Tooltip>
      <TooltipTrigger
        delay={150}
        render={<span data-tax-basis={basis} tabIndex={explain === "focus" ? 0 : undefined} />}
        className={cn(badge, "cursor-help outline-none focus-visible:ring-2 focus-visible:ring-ring")}
      >
        {face}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs normal-case tracking-normal">
        <Explanation basis={basis} taxLabel={taxLabel} taxRatePct={taxRatePct} other={other} note={note} />
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * A money figure inside its tax-basis badge. Pass the basis the figure is on;
 * with `taxBasis="both"` and a rate, the same price on the other basis follows
 * in its own badge, muted, so an ex-tax figure can be checked against a shelf
 * that shows inc. Without a rate, "both" shows the one figure; without a basis,
 * the figure stands alone with no badge.
 */
export function PriceFigure({
  value,
  basis,
  taxLabel = "GST",
  taxRatePct = null,
  taxBasis = "show",
  short = false,
  stacked = false,
  explain = "focus",
  note,
  format,
  locale,
  currency,
  className,
}: {
  /** The price, on `basis`. null prints "—". */
  value: number | null
  /** The basis `value` is on. null or undefined when the source did not say. */
  basis: TaxBasis | null | undefined
  taxLabel?: string
  /** The rate behind `taxBasis="both"` and the hover, in percent (10 for 10%). */
  taxRatePct?: number | null
  taxBasis?: TaxBasisDisplay
  /** Badges print "inc" / "ex" without the label. */
  short?: boolean
  /** With "both", the second figure goes under the first instead of beside it. */
  stacked?: boolean
  explain?: TaxBasisExplain
  /** A further line for the hover. */
  note?: ReactNode
  /** Formats each figure; defaults to `formatMoney` with `locale` and `currency`. */
  format?: (value: number) => string
  className?: string
} & RetailLocale) {
  if (value === null || !Number.isFinite(value)) return <span className={cn("tabular-nums", className)}>—</span>
  const print = format ?? ((amount: number) => formatMoney(amount, { locale, currency }))
  const marked = taxBasis !== "hide" && (basis === "inclusive" || basis === "exclusive") ? basis : null
  if (!marked) return <span className={cn("tabular-nums", className)}>{print(value)}</span>
  const other = otherBasisPrice(value, marked, taxRatePct)
  const otherBasis: TaxBasis = marked === "exclusive" ? "inclusive" : "exclusive"
  const shared = { taxLabel, short, taxRatePct, explain }
  const first = <TaxBasisMark basis={marked} other={other === null ? null : print(other)} note={note} {...shared}>{print(value)}</TaxBasisMark>
  if (taxBasis !== "both" || other === null) return <span className={cn("inline-flex", className)}>{first}</span>
  return (
    <span className={cn("inline-flex", stacked ? "flex-col items-end gap-0.5" : "flex-wrap items-center gap-x-1.5 gap-y-0.5", className)}>
      {first}
      <TaxBasisMark basis={otherBasis} other={print(value)} className="text-[0.92em] font-normal opacity-75" {...shared}>{print(other)}</TaxBasisMark>
    </span>
  )
}
