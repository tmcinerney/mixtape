import { useRoutes, Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { YotoProvider } from './auth/yoto-provider'
import { useTheme } from './hooks/use-theme'
import { routes } from './routes'
import './styles/header.css'
import './styles/footer.css'

function Header() {
  const { theme, toggleTheme } = useTheme()
  const { user, logout, isAuthenticated } = useAuth0()

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        {/* AIDEV-NOTE: cassette reel icon — O—O */}
        <span aria-hidden="true" className="header-logo-icon">
          O—O
        </span>
        <span className="header-logo-text">mixtape</span>
      </Link>
      <div className="header-actions">
        <button
          className="header-theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '☽' : '☀'}
        </button>
        {isAuthenticated && user ? (
          <>
            {user.picture ? (
              <img src={user.picture} alt={user.name ?? 'User avatar'} className="header-avatar" />
            ) : null}
            <button
              className="header-logout"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
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
      <main className="app-main">
        {isAuthenticated ? <YotoProvider>{routeElement}</YotoProvider> : routeElement}
      </main>
      <footer className="footer">
        &copy; mixtape
        <span className="footer-separator">&middot;</span>
        Help
        <span className="footer-separator">&middot;</span>
        Log out
      </footer>
    </>
  )
}
