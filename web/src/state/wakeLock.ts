import { useEffect, useState } from 'react'

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

/** Keeps the screen on while `enabled`, re-acquiring the lock when the page becomes visible again. */
export function useWakeLock(enabled: boolean): boolean {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!enabled || !wakeLockSupported()) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        sentinel = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await sentinel.release()
          return
        }
        setActive(true)
        sentinel.addEventListener('release', () => setActive(false))
      } catch {
        setActive(false) // denied, e.g. battery saver
      }
    }
    const onVisible = () => void acquire()

    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void sentinel?.release().catch(() => undefined)
      setActive(false)
    }
  }, [enabled])

  return active
}
