import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { createYotoSdk, type YotoSdk } from '@yotoplay/yoto-sdk'

interface YotoContextValue {
  sdk: YotoSdk | null
  isReady: boolean
}

const YotoContext = createContext<YotoContextValue>({ sdk: null, isReady: false })

// AIDEV-NOTE: re-creates SDK instance whenever the Auth0 access token refreshes
export function YotoProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0()
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setToken(null)
      return
    }

    let cancelled = false
    getAccessTokenSilently()
      .then((t) => {
        if (!cancelled) setToken(t)
      })
      .catch((err) => {
        console.error('Failed to get access token:', err)
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated, getAccessTokenSilently])

  const sdk = useMemo(() => {
    if (!token) return null
    return createYotoSdk({ jwt: token })
  }, [token])

  const value = useMemo(() => ({ sdk, isReady: sdk !== null }), [sdk])

  return <YotoContext.Provider value={value}>{children}</YotoContext.Provider>
}

export function useYoto(): YotoContextValue {
  return useContext(YotoContext)
}
