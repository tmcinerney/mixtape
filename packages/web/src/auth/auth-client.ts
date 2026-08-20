import pkceChallenge from 'pkce-challenge'

// AIDEV-NOTE: Hand-rolled PKCE, deliberately NOT @auth0/auth0-react.
// Yoto's scope migration (yoto.dev/blog/api-scopes, deadline 2026-06-30) means an
// app may only request scopes pre-approved on its dashboard.yoto.dev registration.
// That list is exactly five scopes and includes neither `openid` nor `profile`.
// @auth0/auth0-spa-js appends `openid` to every request with no opt-out
// (see its typings/global.d.ts: "The `openid` scope is **always applied**"), so it
// can never satisfy this tenant. Yoto's own examples hand-roll the flow too:
// github.com/yotoplay/examples react/src/pages/Login.jsx
export const YOTO_AUTH_BASE = 'https://login.yotoplay.com'
export const YOTO_AUDIENCE = 'https://api.yotoplay.com'

// AIDEV-NOTE: Every scope here must be ticked on the dashboard.yoto.dev app or
// login fails outright with "scopes that have not been pre-approved".
// Derived from the call sites, and identical to the set stuartromanek/louis uses:
//   user:content:view   -> content.getMyCards, content.getCard
//   user:content:manage -> content.updateCard + the server's media upload
//   user:icons:manage   -> icons.getDisplayIcons
//   offline_access      -> refresh tokens. Implicitly granted, not on the tick list.
export const YOTO_SCOPES = 'user:content:view user:content:manage user:icons:manage offline_access'

// AIDEV-NOTE: Public OAuth client id — safe to ship in the bundle, it is visible in
// the authorize redirect regardless. Override at build time with VITE_YOTO_CLIENT_ID.
// This MUST be an app registered after Yoto's 2026 scopes migration. A pre-migration
// registration shows "Status: Legacy app" on dashboard.yoto.dev, carries no scope
// grant, and fails every login with "scopes that have not been pre-approved".
const CLIENT_ID_PLACEHOLDER = 'REPLACE_WITH_NEW_YOTO_CLIENT_ID'

export const YOTO_CLIENT_ID =
  (import.meta.env?.VITE_YOTO_CLIENT_ID as string | undefined) ?? CLIENT_ID_PLACEHOLDER

const SESSION_KEY = 'mixtape.yoto.session'
const VERIFIER_KEY = 'mixtape.yoto.pkce_verifier'
const STATE_KEY = 'mixtape.yoto.pkce_state'
const RETURN_TO_KEY = 'mixtape.yoto.return_to'

// AIDEV-NOTE: Refresh this many ms before real expiry so an in-flight request can't
// straddle the boundary and 401.
const EXPIRY_SKEW_MS = 60_000

export interface Session {
  accessToken: string
  refreshToken: string | null
  /** Epoch ms. */
  expiresAt: number
  /** Space-delimited scopes the server actually granted, which may be narrower. */
  scope: string
}

interface TokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
}

export class AuthError extends Error {
  constructor(
    message: string,
    readonly code: string = 'auth_error',
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

function redirectUri(): string {
  return window.location.origin + '/callback'
}

function readSession(): Session | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    if (typeof parsed?.accessToken !== 'string' || typeof parsed?.expiresAt !== 'number') {
      return null
    }
    return parsed
  } catch {
    // AIDEV-NOTE: Corrupt or unreadable storage is treated as logged out, never fatal.
    return null
  }
}

function writeSession(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  } catch {
    /* storage unavailable (private mode) — the in-memory session still works */
  }
}

function toSession(token: TokenResponse, previous: Session | null): Session {
  return {
    accessToken: token.access_token,
    // AIDEV-NOTE: Auth0 omits refresh_token when rotation is off. Keep the old one
    // rather than dropping to null, or the next refresh has nothing to present.
    refreshToken: token.refresh_token ?? previous?.refreshToken ?? null,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope ?? previous?.scope ?? YOTO_SCOPES,
  }
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${YOTO_AUTH_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  })

  if (!response.ok) {
    // AIDEV-NOTE: Surface Auth0's error_description verbatim. That string is what
    // named `openid, profile` in the original scope failure — do not swallow it.
    let detail = `${response.status} ${response.statusText}`
    try {
      const payload = (await response.json()) as { error?: string; error_description?: string }
      if (payload.error_description) detail = payload.error_description
      else if (payload.error) detail = payload.error
      throw new AuthError(detail, payload.error ?? 'token_request_failed')
    } catch (err) {
      if (err instanceof AuthError) throw err
      throw new AuthError(detail, 'token_request_failed')
    }
  }

  return (await response.json()) as TokenResponse
}

type Listener = () => void

// AIDEV-NOTE: Exported so tests can construct a fresh instance against seeded storage.
// Application code must use the `authClient` singleton — a second live instance would
// defeat the shared in-flight refresh guard below.
export class AuthClient {
  #session: Session | null = readSession()
  #listeners = new Set<Listener>()
  // AIDEV-NOTE: Single shared in-flight refresh. Three call sites reach for a token
  // concurrently (yoto-provider, icon-picker, use-upload-flow); parallel refreshes
  // against a rotating refresh token invalidate each other and log the user out.
  #refreshInFlight: Promise<string> | null = null
  #loading = false
  // AIDEV-NOTE: Proactive refresh timer. Without it nothing renews the token until
  // something calls getAccessTokenSilently, and useYotoQuery never does — so an app
  // left open past expiry 401s on the next card click instead of staying signed in.
  #refreshTimer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    this.#scheduleRefresh()
  }

  #scheduleRefresh(): void {
    if (this.#refreshTimer !== null) {
      clearTimeout(this.#refreshTimer)
      this.#refreshTimer = null
    }

    const session = this.#session
    if (!session?.refreshToken) return

    // Clamped at 0, so a session restored after expiry refreshes on the next tick.
    const delay = Math.max(0, session.expiresAt - Date.now() - EXPIRY_SKEW_MS)
    this.#refreshTimer = setTimeout(() => {
      this.#refreshTimer = null
      // Errors are already handled by #refresh, which clears the session.
      void this.getAccessTokenSilently().catch(() => {})
    }, delay)
  }

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  #emit(): void {
    for (const listener of this.#listeners) listener()
  }

  #setSession(session: Session | null): void {
    this.#session = session
    writeSession(session)
    this.#scheduleRefresh()
    this.#emit()
  }

  getSession = (): Session | null => this.#session

  isLoading = (): boolean => this.#loading

  isAuthenticated = (): boolean => this.#session !== null

  /** Scopes the token server actually granted. May be narrower than requested. */
  grantedScopes = (): string[] => this.#session?.scope.split(/\s+/).filter(Boolean) ?? []

  hasScope = (scope: string): boolean => this.grantedScopes().includes(scope)

  /** Begin the redirect leg. Stores the PKCE verifier and a CSRF state. */
  loginWithRedirect = async (returnTo?: string): Promise<void> => {
    // AIDEV-NOTE: Fail loudly here rather than bouncing the user out to Yoto and back
    // with an opaque provider error.
    if (YOTO_CLIENT_ID === CLIENT_ID_PLACEHOLDER) {
      throw new AuthError(
        'No Yoto client id is configured. Create an app at dashboard.yoto.dev, then set VITE_YOTO_CLIENT_ID.',
        'missing_client_id',
      )
    }

    const { code_verifier, code_challenge } = await pkceChallenge()
    const state = crypto.randomUUID()

    sessionStorage.setItem(VERIFIER_KEY, code_verifier)
    sessionStorage.setItem(STATE_KEY, state)
    sessionStorage.setItem(RETURN_TO_KEY, returnTo ?? window.location.pathname)

    const params = new URLSearchParams({
      audience: YOTO_AUDIENCE,
      scope: YOTO_SCOPES,
      response_type: 'code',
      client_id: YOTO_CLIENT_ID,
      code_challenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri(),
      state,
    })

    window.location.href = `${YOTO_AUTH_BASE}/authorize?${params.toString()}`
  }

  /**
   * Complete the redirect leg. Returns the path to navigate to.
   * Safe to call twice — StrictMode double-invokes effects in development.
   */
  handleRedirectCallback = async (search: string): Promise<string> => {
    const params = new URLSearchParams(search)
    const error = params.get('error')
    if (error) {
      throw new AuthError(params.get('error_description') ?? error, error)
    }

    const code = params.get('code')
    if (!code) throw new AuthError('No authorization code in callback', 'missing_code')

    const expectedState = sessionStorage.getItem(STATE_KEY)
    if (expectedState && params.get('state') !== expectedState) {
      throw new AuthError('State mismatch — possible CSRF', 'state_mismatch')
    }

    const verifier = sessionStorage.getItem(VERIFIER_KEY)
    if (!verifier) throw new AuthError('Missing PKCE verifier', 'missing_verifier')

    this.#loading = true
    this.#emit()
    try {
      const token = await postToken({
        grant_type: 'authorization_code',
        client_id: YOTO_CLIENT_ID,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri(),
      })
      this.#setSession(toSession(token, null))
    } finally {
      this.#loading = false
      sessionStorage.removeItem(VERIFIER_KEY)
      sessionStorage.removeItem(STATE_KEY)
      this.#emit()
    }

    const returnTo = sessionStorage.getItem(RETURN_TO_KEY)
    sessionStorage.removeItem(RETURN_TO_KEY)
    return returnTo && returnTo !== '/callback' ? returnTo : '/'
  }

  /**
   * Return a valid access token, refreshing if needed.
   * Stable identity — safe in a useEffect dependency array.
   */
  getAccessTokenSilently = async (): Promise<string> => {
    const session = this.#session
    if (!session) throw new AuthError('Not authenticated', 'login_required')

    if (Date.now() < session.expiresAt - EXPIRY_SKEW_MS) {
      return session.accessToken
    }

    if (this.#refreshInFlight) return this.#refreshInFlight

    this.#refreshInFlight = this.#refresh(session).finally(() => {
      this.#refreshInFlight = null
    })
    return this.#refreshInFlight
  }

  async #refresh(session: Session): Promise<string> {
    if (!session.refreshToken) {
      // AIDEV-NOTE: No refresh token means offline_access was not granted. Clearing
      // here surfaces as isAuthenticated=false so the UI prompts a fresh login,
      // instead of looping on 401s.
      this.#setSession(null)
      throw new AuthError('Session expired and no refresh token is available', 'login_required')
    }

    try {
      const token = await postToken({
        grant_type: 'refresh_token',
        client_id: YOTO_CLIENT_ID,
        refresh_token: session.refreshToken,
      })
      const next = toSession(token, session)
      this.#setSession(next)
      return next.accessToken
    } catch (err) {
      this.#setSession(null)
      throw err
    }
  }

  logout = (): void => {
    this.#setSession(null)
  }
}

export const authClient = new AuthClient()
