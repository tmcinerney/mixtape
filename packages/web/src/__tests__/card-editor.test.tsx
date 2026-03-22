import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const mockGetCard = vi.fn()
const mockUpdateCard = vi.fn()

const mockUseYoto = vi.fn()
vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => mockUseYoto(),
}))

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    isAuthenticated: true,
    isLoading: false,
    loginWithRedirect: vi.fn(),
  }),
}))

import { CardEditor } from '../pages/card-editor'

// AIDEV-NOTE: Mock matches the real SDK getCard() response — flat structure
// with chapters as an array of { key, title, tracks: [{ trackUrl, ... }] }
const mockCard = {
  cardId: 'card-1',
  title: 'Bedtime Stories',
  metadata: { icon: 'https://icons.yoto.com/moon.png', color: '#3B82F6' },
  content: {
    activity: 'yoto_Player',
    chapters: [
      {
        key: '00',
        title: 'Chapter One',
        overlayLabel: '1',
        tracks: [
          {
            key: '01',
            trackUrl: 'https://audio.yoto.com/ch1.opus',
            format: 'opus',
            channels: 'stereo',
            type: 'audio',
            title: 'Chapter One',
          },
        ],
      },
      {
        key: '01',
        title: 'Chapter Two',
        overlayLabel: '2',
        tracks: [
          {
            key: '01',
            trackUrl: 'https://audio.yoto.com/ch2.opus',
            format: 'opus',
            channels: 'stereo',
            type: 'audio',
            title: 'Chapter Two',
          },
        ],
      },
      {
        key: '02',
        title: 'Chapter Three',
        overlayLabel: '3',
        tracks: [
          {
            key: '01',
            trackUrl: 'https://audio.yoto.com/ch3.opus',
            format: 'opus',
            channels: 'stereo',
            type: 'audio',
            title: 'Chapter Three',
          },
        ],
      },
    ],
    config: { onlineOnly: false },
    version: '1',
    restricted: true,
  },
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/cards/card-1']}>
      <Routes>
        <Route path="/cards/:cardId" element={<CardEditor />} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CardEditor', () => {
  beforeEach(() => {
    mockGetCard.mockReset()
    mockUpdateCard.mockReset()
    mockUseYoto.mockReturnValue({
      sdk: {
        content: { getCard: mockGetCard, updateCard: mockUpdateCard },
      },
      isReady: true,
    })
  })

  it('loads and displays card title', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    renderEditor()

    expect(await screen.findByDisplayValue('Bedtime Stories')).toBeInTheDocument()
  })

  it('displays track list', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    renderEditor()

    expect(await screen.findByDisplayValue('Chapter One')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chapter Two')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chapter Three')).toBeInTheDocument()
  })

  it('can edit card title', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    renderEditor()

    const titleInput = await screen.findByDisplayValue('Bedtime Stories')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'New Title')

    expect(screen.getByDisplayValue('New Title')).toBeInTheDocument()
  })

  it('renders drag handles for reordering', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    renderEditor()

    await screen.findByDisplayValue('Chapter One')

    const dragHandles = screen.getAllByRole('button', { name: /drag to reorder/i })
    expect(dragHandles).toHaveLength(3)
  })

  it('save calls updateCard with modified data', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    mockUpdateCard.mockResolvedValue(undefined)
    renderEditor()

    const titleInput = await screen.findByDisplayValue('Bedtime Stories')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated Title')

    // AIDEV-NOTE: Auto-save triggers after 1s debounce on title change
    await waitFor(() => {
      expect(mockUpdateCard).toHaveBeenCalledWith(
        expect.objectContaining({
          cardId: 'card-1',
          title: 'Updated Title',
        }),
      )
    })
  })

  it('delete removes a track', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    renderEditor()

    await screen.findByDisplayValue('Chapter One')

    const deleteButtons = screen.getAllByRole('button', { name: /delete track/i })
    await userEvent.click(deleteButtons[0]!)

    expect(screen.queryByDisplayValue('Chapter One')).not.toBeInTheDocument()
    expect(screen.getByDisplayValue('Chapter Two')).toBeInTheDocument()
  })

  it('shows skeleton while fetching card', () => {
    mockGetCard.mockReturnValue(new Promise(() => {}))
    renderEditor()

    expect(document.querySelector('.skeleton')).toBeInTheDocument()
  })
})
