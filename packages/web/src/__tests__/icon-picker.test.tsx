import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockGetDisplayIcons = vi.fn()

const mockUseYoto = vi.fn()
vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => mockUseYoto(),
}))

import { IconPicker, _resetIconCache } from '../components/icon-picker'

const mockIcons = [
  { name: 'Moon', url: 'https://icons.yoto.com/moon.png', category: 'nature' },
  { name: 'Sun', url: 'https://icons.yoto.com/sun.png', category: 'nature' },
  { name: 'Guitar', url: 'https://icons.yoto.com/guitar.png', category: 'music' },
  { name: 'Piano', url: 'https://icons.yoto.com/piano.png', category: 'music' },
  { name: 'Rocket', url: 'https://icons.yoto.com/rocket.png', category: 'space' },
]

describe('IconPicker', () => {
  const onSelect = vi.fn()

  beforeEach(() => {
    _resetIconCache()
    mockGetDisplayIcons.mockReset()
    onSelect.mockReset()
    mockUseYoto.mockReturnValue({
      sdk: { icons: { getDisplayIcons: mockGetDisplayIcons } },
      isReady: true,
    })
  })

  it('loads and displays icons', async () => {
    mockGetDisplayIcons.mockResolvedValue(mockIcons)

    render(<IconPicker onSelect={onSelect} />)

    expect(await screen.findByAltText('Moon')).toBeInTheDocument()
    expect(screen.getByAltText('Sun')).toBeInTheDocument()
    expect(screen.getByAltText('Guitar')).toBeInTheDocument()
  })

  it('filters icons by search text', async () => {
    mockGetDisplayIcons.mockResolvedValue(mockIcons)

    render(<IconPicker onSelect={onSelect} />)

    await screen.findByAltText('Moon')

    await userEvent.type(screen.getByPlaceholderText(/search/i), 'moon')

    expect(screen.getByAltText('Moon')).toBeInTheDocument()
    expect(screen.queryByAltText('Guitar')).not.toBeInTheDocument()
    expect(screen.queryByAltText('Rocket')).not.toBeInTheDocument()
  })

  it('fires onSelect callback when icon is clicked', async () => {
    mockGetDisplayIcons.mockResolvedValue(mockIcons)

    render(<IconPicker onSelect={onSelect} />)

    const moonIcon = await screen.findByAltText('Moon')
    await userEvent.click(moonIcon)

    expect(onSelect).toHaveBeenCalledWith(mockIcons[0])
  })

  it('caches icons across re-renders', async () => {
    mockGetDisplayIcons.mockResolvedValue(mockIcons)

    const { rerender } = render(<IconPicker onSelect={onSelect} />)

    await screen.findByAltText('Moon')
    expect(mockGetDisplayIcons).toHaveBeenCalledTimes(1)

    rerender(<IconPicker onSelect={onSelect} />)

    await waitFor(() => {
      expect(mockGetDisplayIcons).toHaveBeenCalledTimes(1)
    })
  })

  it('shows loading state while fetching icons', () => {
    mockGetDisplayIcons.mockReturnValue(new Promise(() => {}))

    render(<IconPicker onSelect={onSelect} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
