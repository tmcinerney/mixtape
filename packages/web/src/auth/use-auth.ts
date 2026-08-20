import { useSyncExternalStore } from 'react'
import { authClient } from './auth-client'

export interface UseAuthResult {
  isAuthenticated: boolean
  isLoading: boolean
  loginWithRedirect: (returnTo?: string) => Promise<void>
  logout: () => void
  /** Stable identity — safe to put in a useEffect dependency array. */
  getAccessTokenSilently: () => Promise<string>
  hasScope: (scope: string) => boolean
}

// AIDEV-NOTE: Subscribes straight to the module-level authClient — no context provider.
// The token engine lives outside React so getAccessTokenSilently keeps a stable
// identity across renders. yoto-provider.tsx lists it in an effect dep array that
// re-creates the Yoto SDK, so a fresh function each render would loop forever.
export function useAuth(): UseAuthResult {
  const session = useSyncExternalStore(authClient.subscribe, authClient.getSession)
  const isLoading = useSyncExternalStore(authClient.subscribe, authClient.isLoading)

  return {
    isAuthenticated: session !== null,
    isLoading,
    loginWithRedirect: authClient.loginWithRedirect,
    logout: authClient.logout,
    getAccessTokenSilently: authClient.getAccessTokenSilently,
    hasScope: authClient.hasScope,
  }
}
