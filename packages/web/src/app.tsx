import { useRoutes } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { YotoProvider } from './auth/yoto-provider'
import { useTheme } from './hooks/use-theme'
import { routes } from './routes'

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '1rem',
}

const logoStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.5rem' }
const actionsStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '1rem' }
const avatarStyle: React.CSSProperties = { width: 32, height: 32, borderRadius: '50%' }

function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout, isAuthenticated } = useAuth0()

  return (
    <header style={headerStyle}>
      <div style={logoStyle}>
        {/* AIDEV-NOTE: cassette reel icon — O—O */}
        <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>
          O—O
        </span>
        <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>mixtape</span>
      </div>
      <div style={actionsStyle}>
        <button
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {isAuthenticated && user ? (
          <>
            {user.picture ? (
              <img src={user.picture} alt={user.name ?? 'User avatar'} style={avatarStyle} />
            ) : null}
            <button onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}>
              Logout
            </button>
          </>
        ) : null}
      </div>
    </header>
  )
}

// AIDEV-NOTE: Landing page is public. Auth triggers when user tries to
// start a job or manage cards. YotoProvider only renders when authenticated
// so SDK calls don't fire without a token.
export function App() {
  const { isAuthenticated } = useAuth0()
  const routeElement = useRoutes(routes)

  return (
    <>
      <Header />
      <main style={{ padding: '1rem' }}>
        {isAuthenticated ? <YotoProvider>{routeElement}</YotoProvider> : routeElement}
      </main>
    </>
  )
}
