import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Re-renders when the phone-width breakpoint is crossed.
 *
 * The media query is already an external store, so it is read through
 * `useSyncExternalStore` rather than copied into state from an effect: the
 * value is correct on the very first render (no "unknown, then suddenly
 * mobile" flicker) and on every resize, without React having to reconcile a
 * state write that only exists to mirror something it can subscribe to.
 */
function subscribe(onStoreChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY)
  media.addEventListener("change", onStoreChange)
  return () => media.removeEventListener("change", onStoreChange)
}

/** Whether the viewport is phone-width right now. */
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    /* No viewport on the server: a render that happens there is not a phone. */
    () => false,
  )
}
