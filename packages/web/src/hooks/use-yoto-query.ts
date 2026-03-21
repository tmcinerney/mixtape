import { useCallback, useEffect, useRef, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { YotoSdk } from '@yotoplay/yoto-sdk'

export interface YotoQueryResult<T> {
  data: T | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Generic hook for SDK data fetching with consistent loading/error handling.
 *
 * AIDEV-NOTE: Replaces the 5x copy-pasted pattern of useState+useEffect+cancelled
 * flag across card-grid, card-editor, card-selector, icon-picker, yoto-provider.
 * The queryFn receives the SDK instance and returns a promise. The hook manages
 * the full lifecycle: waits for SDK readiness, handles cancellation on unmount,
 * and exposes refetch for cache invalidation.
 *
 * @param queryFn - Called with the SDK once it's ready. Return the data to cache.
 * @param deps - Additional dependencies that should trigger a re-fetch.
 */
export function useYotoQuery<T>(
  queryFn: (sdk: YotoSdk) => Promise<T>,
  deps: unknown[] = [],
): YotoQueryResult<T> {
  const { sdk, isReady } = useYoto()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fetchCount = useRef(0)

  const execute = useCallback(() => {
    if (!isReady || !sdk) return

    const currentFetch = ++fetchCount.current
    setLoading(true)
    setError(null)

    queryFn(sdk)
      .then((result) => {
        if (currentFetch === fetchCount.current) {
          setData(result)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (currentFetch === fetchCount.current) {
          setError(err instanceof Error ? err.message : 'An error occurred')
          setLoading(false)
        }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, isReady, ...deps])

  useEffect(() => {
    execute()
  }, [execute])

  return { data, loading, error, refetch: execute }
}
