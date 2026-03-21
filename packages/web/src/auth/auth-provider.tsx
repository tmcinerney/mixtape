import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Auth0Provider, useAuth0 } from '@auth0/auth0-react'

interface AuthProviderProps {
  children: ReactNode
}

// AIDEV-NOTE: Auth0 PKCE config for Yoto OAuth — client-side tokens only
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <Auth0Provider
      domain="login.yotoplay.com"
      clientId="h38kpMcg6VSwhl42BaVZdeEPguh9LPBd"
      authorizationParams={{
        audience: 'https://api.yotoplay.com',
        scope: 'offline_access openid profile',
        redirect_uri: window.location.origin + '/callback',
      }}
      useRefreshTokens={true}
      cacheLocation="memory"
    >
      {children}
    </Auth0Provider>
  )
}

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect()
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  if (isLoading || !isAuthenticated) {
    return null
  }

  return <>{children}</>
}
