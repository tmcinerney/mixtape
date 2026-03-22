import { useCallback, useEffect, useRef, useState } from 'react'
import { useRoutes, Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { YotoProvider } from './auth/yoto-provider'
import { useTheme } from './hooks/use-theme'
import { routes } from './routes'
import './styles/header.css'
import './styles/footer.css'

function AvatarMenu() {
  const { user, logout } = useAuth0()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setOpen(false), [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, close])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, close])

  if (!user) return null

  return (
    <div className="header-avatar-menu" ref={menuRef}>
      <button className="header-avatar-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
        {user.picture ? (
          <img src={user.picture} alt={user.name ?? 'User avatar'} className="header-avatar" />
        ) : (
          <span className="header-avatar-fallback">{user.name?.[0] ?? '?'}</span>
        )}
      </button>
      {open ? (
        <div className="header-dropdown" role="menu">
          <div className="header-dropdown-user">
            <span className="header-dropdown-name">{user.name}</span>
            {user.email ? <span className="header-dropdown-email">{user.email}</span> : null}
          </div>
          <hr className="header-dropdown-divider" />
          <button
            className="header-dropdown-item"
            role="menuitem"
            onClick={() => {
              close()
              logout({ logoutParams: { returnTo: window.location.origin } })
            }}
          >
            Log out
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Header() {
  const { preference, cycleTheme } = useTheme()
  const { isAuthenticated } = useAuth0()

  return (
    <header className="header">
      <Link to="/" className="header-logo">
        {/* AIDEV-NOTE: Static cassette SVG derived from cassette-loader.tsx */}
        <svg
          className="header-logo-icon"
          viewBox="0 0 120 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="4"
            y="8"
            width="112"
            height="64"
            rx="8"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <rect
            x="20"
            y="20"
            width="80"
            height="28"
            rx="4"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <circle cx="42" cy="34" r="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="42" cy="34" r="3" fill="currentColor" />
          <circle cx="78" cy="34" r="10" stroke="currentColor" strokeWidth="2" />
          <circle cx="78" cy="34" r="3" fill="currentColor" />
          <line
            x1="52"
            y1="34"
            x2="68"
            y2="34"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <rect x="30" y="54" width="60" height="10" rx="2" fill="currentColor" opacity="0.15" />
        </svg>
        <span className="header-logo-text">mixtape</span>
      </Link>
      <div className="header-actions">
        <button
          className="header-theme-toggle"
          onClick={cycleTheme}
          aria-label={`Theme: ${preference} (click to change)`}
        >
          {preference === 'light' ? '☀' : preference === 'dark' ? '☽' : '⚙'}
        </button>
        {isAuthenticated ? <AvatarMenu /> : null}
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
      <footer className="footer">&copy; mixtape</footer>
    </>
  )
}
