import { useEffect, useRef } from 'react'

/**
 * Call `fn` on an interval while the browser tab is visible.
 * Also runs once when the tab becomes visible again.
 */
export function usePollingWhenVisible(fn: () => void, intervalMs: number): void {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (intervalMs <= 0) return

    let timer: ReturnType<typeof setInterval> | undefined

    const clear = () => {
      if (timer !== undefined) {
        clearInterval(timer)
        timer = undefined
      }
    }

    const start = () => {
      clear()
      timer = setInterval(() => {
        if (!document.hidden) fnRef.current()
      }, intervalMs)
    }

    const onVisibility = () => {
      if (document.hidden) {
        clear()
        return
      }
      fnRef.current()
      start()
    }

    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clear()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])
}

/** Background listing refresh — balances freshness vs Spire load. */
export const ORDERS_POLL_MS = 30_000
