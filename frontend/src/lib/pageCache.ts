const PREFIX = 'san_pcache:'

type CacheEnvelope<T> = {
  at: number
  data: T
}

export function readPageCache<T>(key: string, maxAgeMs = 60_000): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEnvelope<T>
    if (!parsed || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at > maxAgeMs) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writePageCache<T>(key: string, data: T): void {
  try {
    const payload: CacheEnvelope<T> = { at: Date.now(), data }
    sessionStorage.setItem(PREFIX + key, JSON.stringify(payload))
  } catch {
    // ignore quota errors
  }
}

export function clearPageCaches(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(PREFIX) || k === 'san_dashboard_cache') keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}

/** Warm a route chunk + optional API in the background */
export function prefetchRoute(importer: () => Promise<unknown>): void {
  void importer().catch(() => undefined)
}
