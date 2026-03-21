import { useRoutes, useLocation } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { ProtectedRoute } from './auth/auth-provider'
import { YotoProvider } from './auth/yoto-provider'
import { useTheme } from './hooks/use-theme'
import { routes } from './routes'

function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout, isAuthenticated } = useAuth0()

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* AIDEV-NOTE: cassette reel icon — O—O */}
        <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
          O—O
        </span>
        <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>mixtape</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {isAuthenticated && user && (
          <>
            {user.picture && (
              <img
                src={user.picture}
                alt={user.name ?? 'User avatar'}
                style={{ width: 32, height: 32, borderRadius: '50%' }}
              />
            )}
            <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              Logout
            </button>
          </>
        )}
      </div>
    </header>
  )
}

export function App() {
  const location = useLocation()
  const routeElement = useRoutes(routes)

  // AIDEV-NOTE: /callback is unprotected — Auth0 redirect handler
  const isCallbackRoute = location.pathname === '/callback'

  if (isCallbackRoute) {
    return <>{routeElement}</>
  }

  return (
    <ProtectedRoute>
      <YotoProvider>
        <Header />
        <main style={{ padding: '1rem' }}>{routeElement}</main>
      </YotoProvider>
    </ProtectedRoute>
  )
}
