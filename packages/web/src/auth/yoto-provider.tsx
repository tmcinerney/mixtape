import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './use-auth'
import { createYotoSdk, type YotoSdk } from '@yotoplay/yoto-sdk'

interface YotoContextValue {
  sdk: YotoSdk | null
  isReady: boolean
}

const YotoContext = createContext<YotoContextValue>({ sdk: null, isReady: false })

// AIDEV-NOTE: re-creates the SDK instance whenever the access token refreshes.
// `accessToken` must stay in the effect deps below: the SDK is constructed with a
// token STRING, so without it a refresh would leave this holding the old JWT
// indefinitely (isAuthenticated stays true, so nothing else in the deps changes).
// Never call sdk.login() — the SDK hardcodes `openid profile email` (its dist bundles
// that string), and Yoto pre-approves neither `openid` nor `profile`, so it fails
// exactly the way the old @auth0/auth0-react setup did. Always construct with { jwt }
// from our own PKCE flow in auth-client.ts.
export function YotoProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, accessToken, getAccessTokenSilently } = useAuth()
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
  }, [isAuthenticated, accessToken, getAccessTokenSilently])

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
