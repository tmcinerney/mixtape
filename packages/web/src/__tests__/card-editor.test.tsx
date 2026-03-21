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
    loginWithRedirect: vi.fn(),
  }),
}))

import { CardEditor } from '../pages/card-editor'

const mockCard = {
  card: {
    cardId: 'card-1',
    title: 'Bedtime Stories',
    metadata: { icon: 'https://icons.yoto.com/moon.png', color: '#3B82F6' },
    content: {
      activity: 'none',
      editTracksDisabled: false,
      chapters: {
        '00': {
          title: 'Chapter One',
          format: 'opus',
          channels: 'stereo',
          type: 'audio',
          url: 'https://audio.yoto.com/ch1.opus',
        },
        '01': {
          title: 'Chapter Two',
          format: 'opus',
          channels: 'stereo',
          type: 'audio',
          url: 'https://audio.yoto.com/ch2.opus',
        },
        '02': {
          title: 'Chapter Three',
          format: 'opus',
          channels: 'stereo',
          type: 'audio',
          url: 'https://audio.yoto.com/ch3.opus',
        },
      },
      config: { onlineOnly: true },
      version: 2,
      restricted: false,
    },
  },
}

function renderEditor() {
  return render(
    <MemoryRouter initialEntries={['/cards/card-1']}>
      <Routes>
        <Route path="/cards/:cardId" element={<CardEditor />} />
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

  it('reorder moves track up', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    renderEditor()

    await screen.findByDisplayValue('Chapter One')

    // AIDEV-NOTE: find move-up buttons for Chapter Two (index 1)
    const moveUpButtons = screen.getAllByRole('button', { name: /move up/i })
    // The first move-up button corresponds to Chapter Two (Chapter One has no move up)
    await userEvent.click(moveUpButtons[0]!)

    // After moving Chapter Two up, the first track should now be Chapter Two
    const trackInputs = screen.getAllByRole('textbox', { name: /track title/i })
    expect(trackInputs[0]!).toHaveValue('Chapter Two')
    expect(trackInputs[1]!).toHaveValue('Chapter One')
  })

  it('save calls updateCard with modified data', async () => {
    mockGetCard.mockResolvedValue(mockCard)
    mockUpdateCard.mockResolvedValue(undefined)
    renderEditor()

    const titleInput = await screen.findByDisplayValue('Bedtime Stories')
    await userEvent.clear(titleInput)
    await userEvent.type(titleInput, 'Updated Title')

    await userEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(mockUpdateCard).toHaveBeenCalledWith(
        expect.objectContaining({
          card: expect.objectContaining({
            title: 'Updated Title',
          }),
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

  it('shows loading while fetching card', () => {
    mockGetCard.mockReturnValue(new Promise(() => {}))
    renderEditor()

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
