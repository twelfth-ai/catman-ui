import { useCallback, useId, useSyncExternalStore } from "react"

/**
 * One hover card open at a time. A badge in a row of badges opens on hover
 * and lingers a beat so the pointer can reach it; without this, sweeping to
 * the next badge opens a second card over the first. Opening any card that
 * uses this closes whichever was open.
 *
 * Part of the twelfth catman registry (`@twelfth/one-open`).
 */
let openId: string | null = null
const listeners = new Set<() => void>()

function setOpenId(next: string | null) {
  if (openId === next) return
  openId = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** `[open, onOpenChange]` for a controlled popover or tooltip. */
export function useOneOpen(): [boolean, (open: boolean) => void] {
  const id = useId()
  const current = useSyncExternalStore(subscribe, () => openId, () => null)
  const onOpenChange = useCallback((open: boolean) => {
    if (open) setOpenId(id)
    else if (openId === id) setOpenId(null)
  }, [id])
  return [current === id, onOpenChange]
}
