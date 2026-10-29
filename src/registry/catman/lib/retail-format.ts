/**
 * Number formatting in the dialect a category manager reads: money, units,
 * percentages, a price index, and weeks of cover. en-AU and AUD by default,
 * because that is who reads it first; pass a locale and currency otherwise.
 *
 * Part of the twelfth catman registry (`@twelfth/retail-format`).
 */

export type RetailLocale = { locale?: string; currency?: string }

const DEFAULT_LOCALE = "en-AU"
const DEFAULT_CURRENCY = "AUD"

export function formatMoney(value: number, { locale = DEFAULT_LOCALE, currency = DEFAULT_CURRENCY, whole = false }: RetailLocale & { whole?: boolean } = {}): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: whole ? 0 : 2,
    minimumFractionDigits: whole ? 0 : 2,
  }).format(value)
}

export function formatUnits(value: number, { locale = DEFAULT_LOCALE }: RetailLocale = {}): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value)
}

/** A percentage already in percent units: `12.4` reads `12%`. */
export function formatPercent(value: number, { locale = DEFAULT_LOCALE, digits = 0 }: RetailLocale & { digits?: number } = {}): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)}%`
}

/** Price index from a position: ours ÷ theirs × 100, so a 12% gap above is 112. */
export function formatIndex(positionPct: number, { locale = DEFAULT_LOCALE }: RetailLocale = {}): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(100 + positionPct)
}

/** A price position in words: "12% above", "4% below", "In line"; "—" when unknown. */
export function formatPosition(positionPct: number | null): string {
  if (positionPct === null || !Number.isFinite(positionPct)) return "—"
  const n = Math.round(Math.abs(positionPct))
  if (n === 0) return "In line"
  return `${n}% ${positionPct > 0 ? "above" : "below"}`
}

/** The same against the market: "12% above market", "In line with market". */
export function formatMarketPosition(positionPct: number | null): string {
  const words = formatPosition(positionPct)
  if (words === "—") return words
  return words === "In line" ? "In line with market" : `${words} market`
}

export function formatWeeks(weeks: number, { locale = DEFAULT_LOCALE }: RetailLocale = {}): string {
  const figure = new Intl.NumberFormat(locale, { maximumFractionDigits: weeks < 10 ? 1 : 0 }).format(weeks)
  return `${figure} ${weeks === 1 ? "wk" : "wks"}`
}
