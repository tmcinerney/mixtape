import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mockGetMyCards = vi.fn()
const mockLoginWithRedirect = vi.fn()

const mockUseYoto = vi.fn()
vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => mockUseYoto(),
}))

const mockUseAuth = vi.fn()
vi.mock('../auth/use-auth', () => ({
  useAuth: () => mockUseAuth(),
}))

import { CardGrid } from '../components/card-grid'

// AIDEV-NOTE: Matches SDK UserCard shape — flat object, no nested card wrapper
const mockCards = [
  {
    cardId: 'card-1',
    title: 'Bedtime Stories',
    cover: { imageS: 'https://images.yoto.com/moon.png' },
  },
  {
    cardId: 'card-2',
    title: 'Morning Songs',
    cover: { imageS: 'https://images.yoto.com/sun.png' },
  },
]

describe('CardGrid', () => {
  beforeEach(() => {
    mockGetMyCards.mockReset()
    mockLoginWithRedirect.mockReset()
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loginWithRedirect: mockLoginWithRedirect,
    })
    mockUseYoto.mockReturnValue({
      sdk: { content: { getMyCards: mockGetMyCards } },
      isReady: true,
    })
  })

  it('renders nothing when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loginWithRedirect: mockLoginWithRedirect,
    })
    mockUseYoto.mockReturnValue({ sdk: null, isReady: false })

    const { container } = render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    expect(container.innerHTML).toBe('')
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

  // AIDEV-NOTE: Regression test. CardGrid owns its own query, so creating a playlist
  // left the grid stale — the new card only appeared after a full page reload. The
  // landing page bumps reloadKey to force the refetch.
  it('refetches when reloadKey changes', async () => {
    mockGetMyCards.mockResolvedValue(mockCards)

    const { rerender } = render(
      <MemoryRouter>
        <CardGrid reloadKey={0} />
      </MemoryRouter>,
    )
    await screen.findByText('Bedtime Stories')
    expect(mockGetMyCards).toHaveBeenCalledTimes(1)

    rerender(
      <MemoryRouter>
        <CardGrid reloadKey={1} />
      </MemoryRouter>,
    )

    await waitFor(() => expect(mockGetMyCards).toHaveBeenCalledTimes(2))
  })

  it('does not refetch when reloadKey is unchanged', async () => {
    mockGetMyCards.mockResolvedValue(mockCards)

    const { rerender } = render(
      <MemoryRouter>
        <CardGrid reloadKey={3} />
      </MemoryRouter>,
    )
    await screen.findByText('Bedtime Stories')

    rerender(
      <MemoryRouter>
        <CardGrid reloadKey={3} />
      </MemoryRouter>,
    )

    expect(mockGetMyCards).toHaveBeenCalledTimes(1)
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

  it('shows skeleton while fetching', () => {
    mockGetMyCards.mockReturnValue(new Promise(() => {})) // never resolves

    render(
      <MemoryRouter>
        <CardGrid />
      </MemoryRouter>,
    )

    expect(document.querySelector('.card-grid-skeleton')).toBeInTheDocument()
  })
})
