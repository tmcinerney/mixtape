import type { ReactNode } from 'react'
import { Auth0Provider } from '@auth0/auth0-react'

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
      // AIDEV-NOTE: localstorage persists tokens across page reloads/navigation.
      // "memory" loses the session on every hard navigation.
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  )
}
