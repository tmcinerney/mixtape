import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockUseAuth0 = vi.fn()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth0Provider = vi.fn(({ children }: any) => (
  <div data-testid="auth0-provider">{children}</div>
))

vi.mock('@auth0/auth0-react', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Auth0Provider: (props: any) => {
    mockAuth0Provider(props)
    return <div data-testid="auth0-provider">{props.children as React.ReactNode}</div>
  },
  useAuth0: () => mockUseAuth0(),
}))

// AIDEV-NOTE: import after mock to ensure mock is in place
import { AuthProvider } from '../auth/auth-provider'

describe('AuthProvider', () => {
  beforeEach(() => {
    mockAuth0Provider.mockClear()
    mockUseAuth0.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      loginWithRedirect: vi.fn(),
      getAccessTokenSilently: vi.fn(),
    })
  })

  it('renders Auth0Provider with correct domain and clientId', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <div>child</div>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(mockAuth0Provider).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'login.yotoplay.com',
        clientId: 'h38kpMcg6VSwhl42BaVZdeEPguh9LPBd',
      }),
    )
  })

  it('configures authorization params with audience and scope', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <div>child</div>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(mockAuth0Provider).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationParams: expect.objectContaining({
          audience: 'https://api.yotoplay.com',
          scope: 'offline_access openid profile',
        }),
      }),
    )
  })

  it('enables refresh tokens with memory cache', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <div>child</div>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(mockAuth0Provider).toHaveBeenCalledWith(
      expect.objectContaining({
        useRefreshTokens: true,
        cacheLocation: 'localstorage',
      }),
    )
  })

  it('renders children within the provider', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <div data-testid="child-content">hello</div>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })
})
