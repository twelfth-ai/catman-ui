import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

/**
 * Which side of the market a figure puts the retailer on, from the retailer's
 * point of view rather than the arithmetic's. A reader is asking one question
 * of every price figure: is this one going my way. Naming the tone after the
 * answer is what lets a price gap, an index and a cover position share it.
 *
 * Part of the Twelfth catman registry (`@twelfth/market-side`). The tones read
 * the `favourable` and `exposed` colour tokens this item installs.
 */
export type MarketSide = "favourable" | "exposed" | "level" | "unknown"

/** From a price position (ours vs theirs, in percent): above market is exposed. */
export function marketSideFromPosition(positionPct: number | null): MarketSide {
  if (positionPct === null || !Number.isFinite(positionPct)) return "unknown"
  if (Math.round(Math.abs(positionPct)) === 0) return "level"
  return positionPct > 0 ? "exposed" : "favourable"
}

/** Tone only. Geometry stays with the caller: a table cell wants a fixed,
 * right-aligned box, a pill wants to hug its contents. */
export const marketToneClass: Record<MarketSide, string> = {
  favourable: "bg-favourable font-semibold text-favourable-foreground",
  exposed: "bg-exposed font-semibold text-exposed-foreground",
  level: "text-foreground",
  unknown: "text-muted-foreground",
}

/** The arrow that survives a reader who cannot separate the two tones.
 *
 * It points the way the figure beside it moved. A price or a gap is THEIR side
 * (the default): exposed is down, they are cheaper. An index is ours ÷ theirs
 * × 100, OUR side: exposed is up, we are priced above. */
export function MarketArrow({ side, className, pointing = "theirs" }: { side: MarketSide; className?: string; pointing?: "theirs" | "ours" }) {
  const up = pointing === "ours" ? side === "exposed" : side === "favourable"
  const down = pointing === "ours" ? side === "favourable" : side === "exposed"
  if (up) return <ArrowUpIcon aria-hidden className={className} />
  if (down) return <ArrowDownIcon aria-hidden className={className} />
  return null
}
