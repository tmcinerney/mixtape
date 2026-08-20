import { useCallback, useEffect, useRef, useState } from 'react'

function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setVersion(d.version))
      .catch(() => {})
  }, [])
  return version
}
import { useRoutes, Link } from 'react-router-dom'
import { useAuth } from './auth/use-auth'
import { YotoProvider } from './auth/yoto-provider'
import { useTheme } from './hooks/use-theme'
import { routes } from './routes'
import './styles/header.css'
import './styles/footer.css'

function AvatarMenu() {
  const { isAuthenticated, logout } = useAuth()
  const version = useAppVersion()
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

  // AIDEV-NOTE: Gate on isAuthenticated, never on a user object. Yoto grants no
  // `profile` scope, so there is no ID token and no profile to gate on — an
  // absent-user check here would hide the Log out button permanently.
  if (!isAuthenticated) return null

  return (
    <div className="header-avatar-menu" ref={menuRef}>
      <button
        className="header-avatar-trigger"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Account menu"
      >
        {/* AIDEV-NOTE: Generic glyph, not an initial. Yoto's scope list has no `profile`,
            so name, email and picture are all unavailable. An initial derived from the
            token `sub` would read as real data while being the same letter for everyone
            (Auth0 subs all start `auth0|` or `google-oauth2|`). */}
        <span className="header-avatar-fallback" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open ? (
        <div className="header-dropdown" role="menu">
          {version ? <span className="header-dropdown-version">v{version}</span> : null}
          <hr className="header-dropdown-divider" />
          <button
            className="header-dropdown-item"
            role="menuitem"
            onClick={() => {
              close()
              // AIDEV-NOTE: Local session clear only. The Yoto SSO session persists, so
              // signing back in is instant with no password prompt. Deliberate: a full
              // /v2/logout would also end the user's my.yotoplay.com session.
              logout()
              window.location.href = '/'
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
  const { isAuthenticated, loginWithRedirect } = useAuth()

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
          {/* AIDEV-NOTE: SVGs instead of emoji for consistent centering across platforms */}
          {preference === 'light' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="3.5" />
              <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="8" y1="0.5" x2="8" y2="2.5" />
                <line x1="8" y1="13.5" x2="8" y2="15.5" />
                <line x1="0.5" y1="8" x2="2.5" y2="8" />
                <line x1="13.5" y1="8" x2="15.5" y2="8" />
                <line x1="2.7" y1="2.7" x2="4.1" y2="4.1" />
                <line x1="11.9" y1="11.9" x2="13.3" y2="13.3" />
                <line x1="2.7" y1="13.3" x2="4.1" y2="11.9" />
                <line x1="11.9" y1="4.1" x2="13.3" y2="2.7" />
              </g>
            </svg>
          ) : preference === 'dark' ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.2 1A7 7 0 0 0 15 9.8 7 7 0 1 1 6.2 1Z" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="1.5" y="2" width="13" height="9" rx="1.5" />
              <line x1="5.5" y1="14" x2="10.5" y2="14" />
              <line x1="8" y1="11" x2="8" y2="14" />
            </svg>
          )}
        </button>
        {isAuthenticated ? (
          <AvatarMenu />
        ) : (
          <button className="header-sign-in" onClick={() => loginWithRedirect()}>
            Sign in
          </button>
        )}
      </div>
    </header>
  )
}

// AIDEV-NOTE: Landing page is public. Auth triggers when user tries to
// start a job or manage cards. YotoProvider only renders when authenticated
// so SDK calls don't fire without a token.
export function App() {
  const { isAuthenticated } = useAuth()
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
