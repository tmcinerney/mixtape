import { useEffect, useMemo, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'

// AIDEV-NOTE: Module-level icon cache shared across all components.
// Icons are fetched once per session and never re-fetched (the list doesn't change).
// This eliminates duplicate API calls from icon-picker, icon-resolver, etc.
let cachedIcons: DisplayIcon[] | null = null
let fetchPromise: Promise<DisplayIcon[]> | null = null

/** Reset the module-level cache (for testing only). */
export function _resetIconCache() {
  cachedIcons = null
  fetchPromise = null
}

/**
 * Shared hook for accessing the Yoto display icon list.
 * Fetches once, caches at module level, returns instantly on subsequent mounts.
 */
export function useIcons() {
  const { sdk, isReady } = useYoto()
  const [icons, setIcons] = useState<DisplayIcon[] | null>(cachedIcons)
  const [loading, setLoading] = useState(cachedIcons === null)

  useEffect(() => {
    if (cachedIcons) {
      setIcons(cachedIcons)
      setLoading(false)
      return
    }

    if (!isReady || !sdk) return

    // Reuse in-flight fetch if another component triggered it
    if (!fetchPromise) {
      fetchPromise = sdk.icons.getDisplayIcons()
    }

    let cancelled = false
    fetchPromise
      .then((result) => {
        cachedIcons = result
        if (!cancelled) {
          setIcons(result)
          setLoading(false)
        }
      })
      .catch(() => {
        fetchPromise = null // allow retry
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sdk, isReady])

  return { icons, loading }
}

/**
 * Shared hook for resolving yoto:#ref → display URL.
 * Uses the cached icon list from useIcons.
 */
export function useIconResolver() {
  const { icons } = useIcons()

  const refToUrl = useMemo(() => {
    if (!icons) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const icon of icons) {
      map.set(`yoto:#${icon.mediaId}`, icon.url)
    }
    return map
  }, [icons])

  return {
    resolve: (ref: string | undefined) => (ref ? refToUrl.get(ref) : undefined),
    loaded: icons !== null,
  }
}
