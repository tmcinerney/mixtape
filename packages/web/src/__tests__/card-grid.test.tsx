import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockGetMyCards = vi.fn()
const mockLoginWithRedirect = vi.fn()

const mockUseYoto = vi.fn()
vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => mockUseYoto(),
}))

const mockUseAuth0 = vi.fn()
vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockUseAuth0(),
}))

import { CardGrid } from '../components/card-grid'

const mockCards = [
  {
    card: {
      cardId: 'card-1',
      title: 'Bedtime Stories',
      metadata: { icon: 'https://icons.yoto.com/moon.png', color: '#3B82F6' },
      content: { chapters: {} },
    },
  },
  {
    card: {
      cardId: 'card-2',
      title: 'Morning Songs',
      metadata: { icon: 'https://icons.yoto.com/sun.png', color: '#F59E0B' },
      content: { chapters: {} },
    },
  },
]

describe('CardGrid', () => {
  beforeEach(() => {
    mockGetMyCards.mockReset()
    mockLoginWithRedirect.mockReset()
    mockUseAuth0.mockReturnValue({
      isAuthenticated: true,
      loginWithRedirect: mockLoginWithRedirect,
    })
    mockUseYoto.mockReturnValue({
      sdk: { content: { getMyCards: mockGetMyCards } },
      isReady: true,
    })
  })

  it('shows sign-in message when not authenticated', () => {
    mockUseAuth0.mockReturnValue({
      isAuthenticated: false,
      loginWithRedirect: mockLoginWithRedirect,
    })
    mockUseYoto.mockReturnValue({ sdk: null, isReady: false })

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    expect(screen.getByText(/sign in to see your cards/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('calls loginWithRedirect when sign-in button is clicked', async () => {
    mockUseAuth0.mockReturnValue({
      isAuthenticated: false,
      loginWithRedirect: mockLoginWithRedirect,
    })
    mockUseYoto.mockReturnValue({ sdk: null, isReady: false })

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(mockLoginWithRedirect).toHaveBeenCalled()
  })

  it('renders cards from SDK data', async () => {
    mockGetMyCards.mockResolvedValue(mockCards)

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Bedtime Stories')).toBeInTheDocument()
    expect(screen.getByText('Morning Songs')).toBeInTheDocument()
  })

  it('renders an "Add Playlist" card', async () => {
    mockGetMyCards.mockResolvedValue(mockCards)

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/add playlist/i)).toBeInTheDocument()
  })

  it('cards link to /cards/:cardId', async () => {
    mockGetMyCards.mockResolvedValue(mockCards)

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /bedtime stories/i })
    expect(link).toHaveAttribute('href', '/cards/card-1')
  })

  it('shows loading state while fetching', () => {
    mockGetMyCards.mockReturnValue(new Promise(() => {})) // never resolves

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
