import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  AuthClient,
  authClient,
  YOTO_SCOPES,
  YOTO_AUDIENCE,
  YOTO_AUTH_BASE,
} from '../auth/auth-client'

// AIDEV-NOTE: pkce-challenge uses Web Crypto, which jsdom only partly provides.
// Stubbing it keeps these tests about our OAuth wiring, not about SHA-256.
vi.mock('pkce-challenge', () => ({
  default: async () => ({ code_verifier: 'test-verifier', code_challenge: 'test-challenge' }),
}))

function stubLocation(): { current: string } {
  const captured = { current: '' }
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://mixtape.trav.cloud',
      pathname: '/',
      search: '',
      set href(value: string) {
        captured.current = value
      },
      get href() {
        return captured.current
      },
    },
  })
  return captured
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  authClient.logout()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('YOTO_SCOPES', () => {
  // AIDEV-NOTE: This is THE regression test. Login broke because the app asked for
  // `openid` and `profile`, which Yoto's scope migration stopped pre-approving.
  // @auth0/auth0-spa-js injected `openid` unconditionally, which is why it had to go.
  it('never requests openid or profile', () => {
    expect(YOTO_SCOPES).not.toMatch(/\bopenid\b/)
    expect(YOTO_SCOPES).not.toMatch(/\bprofile\b/)
  })

  it('requests exactly the scopes the app uses', () => {
    expect(YOTO_SCOPES.split(' ').sort()).toEqual([
      'offline_access',
      'user:content:manage',
      'user:content:view',
      'user:icons:manage',
    ])
  })
})

describe('loginWithRedirect', () => {
  it('builds a PKCE authorize URL with no openid scope', async () => {
    const location = stubLocation()

    await authClient.loginWithRedirect('/cards/abc')

    const url = new URL(location.current)
    expect(url.origin + url.pathname).toBe(`${YOTO_AUTH_BASE}/authorize`)
    expect(url.searchParams.get('audience')).toBe(YOTO_AUDIENCE)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge')
    expect(url.searchParams.get('redirect_uri')).toBe('https://mixtape.trav.cloud/callback')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('scope')).toBe(YOTO_SCOPES)
    expect(url.searchParams.get('scope')).not.toContain('openid')
  })

  it('stores the verifier and return path for the callback leg', async () => {
    stubLocation()
    await authClient.loginWithRedirect('/cards/abc')

    expect(sessionStorage.getItem('mixtape.yoto.pkce_verifier')).toBe('test-verifier')
    expect(sessionStorage.getItem('mixtape.yoto.return_to')).toBe('/cards/abc')
  })
})

describe('handleRedirectCallback', () => {
  it('exchanges the code and authenticates', async () => {
    stubLocation()
    sessionStorage.setItem('mixtape.yoto.pkce_verifier', 'test-verifier')
    sessionStorage.setItem('mixtape.yoto.return_to', '/cards/abc')

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          token_type: 'Bearer',
          expires_in: 86400,
          scope: YOTO_SCOPES,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const returnTo = await authClient.handleRedirectCallback('?code=abc123')

    expect(returnTo).toBe('/cards/abc')
    expect(authClient.isAuthenticated()).toBe(true)
    expect(await authClient.getAccessTokenSilently()).toBe('access-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // The verifier is single-use and must not linger.
    expect(sessionStorage.getItem('mixtape.yoto.pkce_verifier')).toBeNull()
  })

  it('rejects a state mismatch', async () => {
    sessionStorage.setItem('mixtape.yoto.pkce_verifier', 'test-verifier')
    sessionStorage.setItem('mixtape.yoto.pkce_state', 'expected-state')

    await expect(authClient.handleRedirectCallback('?code=abc&state=attacker')).rejects.toThrow(
      /State mismatch/,
    )
  })

  it('surfaces the provider error description verbatim', async () => {
    // AIDEV-NOTE: This is the exact shape of the failure that started all this.
    await expect(
      authClient.handleRedirectCallback(
        '?error=access_denied&error_description=' +
          encodeURIComponent(
            'The application requested access to scopes that have not been pre-approved: openid, profile.',
          ),
      ),
    ).rejects.toThrow(/scopes that have not been pre-approved/)
  })
})

describe('getAccessTokenSilently', () => {
  // AIDEV-NOTE: Fake timers here are load-bearing, not tidiness. A client built on an
  // expired session schedules a 0ms proactive refresh in its constructor. Under real
  // timers that fires as a macrotask mid-test and races the assertions below.
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function clientWithExpiredSession(refreshToken: string | null) {
    localStorage.setItem(
      'mixtape.yoto.session',
      JSON.stringify({
        accessToken: 'stale',
        refreshToken,
        expiresAt: Date.now() - 1000,
        scope: YOTO_SCOPES,
      }),
    )
    // A fresh instance reads the seeded session at construction.
    return new AuthClient()
  }

  it('collapses concurrent refreshes into a single token request', async () => {
    const client = clientWithExpiredSession('refresh-1')

    let release: (r: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      release = resolve
    })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockReturnValue(pending)

    // Three concurrent callers, mirroring the real ones:
    // yoto-provider.tsx, icon-picker.tsx and use-upload-flow.ts.
    const calls = Promise.all([
      client.getAccessTokenSilently(),
      client.getAccessTokenSilently(),
      client.getAccessTokenSilently(),
    ])

    release(
      new Response(
        JSON.stringify({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          token_type: 'Bearer',
          expires_in: 86400,
          scope: YOTO_SCOPES,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    // AIDEV-NOTE: The point of this test. Parallel refreshes against a rotating
    // refresh token invalidate each other and silently log the user out mid-upload.
    expect(await calls).toEqual(['access-2', 'access-2', 'access-2'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses a still-valid token without hitting the network', async () => {
    localStorage.setItem(
      'mixtape.yoto.session',
      JSON.stringify({
        accessToken: 'fresh',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 3_600_000,
        scope: YOTO_SCOPES,
      }),
    )
    const client = new AuthClient()
    const fetchMock = vi.spyOn(globalThis, 'fetch')

    expect(await client.getAccessTokenSilently()).toBe('fresh')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('clears the session when refresh fails so the UI prompts a new login', async () => {
    const client = clientWithExpiredSession('refresh-1')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(client.getAccessTokenSilently()).rejects.toThrow(/invalid_grant/)
    expect(client.isAuthenticated()).toBe(false)
  })

  it('gives up cleanly when offline_access was never granted', async () => {
    const client = clientWithExpiredSession(null)
    await expect(client.getAccessTokenSilently()).rejects.toThrow(/no refresh token/)
    expect(client.isAuthenticated()).toBe(false)
  })

  it('throws when there is no session at all', async () => {
    await expect(authClient.getAccessTokenSilently()).rejects.toThrow(/Not authenticated/)
  })
})

describe('proactive refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // AIDEV-NOTE: useYotoQuery never calls getAccessTokenSilently, so without this timer
  // an app left open past expiry 401s on the next card click rather than staying in.
  it('renews the token before it expires, with nobody asking', async () => {
    localStorage.setItem(
      'mixtape.yoto.session',
      JSON.stringify({
        accessToken: 'first',
        refreshToken: 'refresh-1',
        expiresAt: Date.now() + 120_000,
        scope: YOTO_SCOPES,
      }),
    )
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'second',
          refresh_token: 'refresh-2',
          token_type: 'Bearer',
          expires_in: 86400,
          scope: YOTO_SCOPES,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    const client = new AuthClient()
    expect(fetchMock).not.toHaveBeenCalled()

    // Expiry is 120s out and the skew is 60s, so the timer is armed for 60s.
    await vi.advanceTimersByTimeAsync(61_000)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(client.getSession()?.accessToken).toBe('second')
    client.logout()
  })

  it('arms no timer when there is no refresh token', () => {
    localStorage.setItem(
      'mixtape.yoto.session',
      JSON.stringify({
        accessToken: 'only',
        refreshToken: null,
        expiresAt: Date.now() + 120_000,
        scope: YOTO_SCOPES,
      }),
    )
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const client = new AuthClient()

    vi.advanceTimersByTime(600_000)

    expect(fetchMock).not.toHaveBeenCalled()
    client.logout()
  })
})

describe('granted scope readback', () => {
  // AIDEV-NOTE: Borrowed from stuartromanek/louis — trust what the server granted,
  // not what we asked for. A narrowed grant should be detectable, not assumed.
  it('reports the scopes the server actually granted', () => {
    localStorage.setItem(
      'mixtape.yoto.session',
      JSON.stringify({
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: Date.now() + 3_600_000,
        scope: 'user:content:view offline_access',
      }),
    )
    const client = new AuthClient()

    expect(client.hasScope('user:content:view')).toBe(true)
    expect(client.hasScope('user:content:manage')).toBe(false)
  })
})
