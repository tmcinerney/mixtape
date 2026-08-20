import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockUpdateCard = vi.fn()

vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => ({
    sdk: { content: { updateCard: mockUpdateCard } },
    isReady: true,
  }),
}))

vi.mock('../components/icon-picker', () => ({
  IconPicker: () => null,
}))

import { CreateCardDialog } from '../components/create-card-dialog'

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateCard.mockResolvedValue(undefined)
})

async function createPlaylist(name = 'My playlist') {
  const user = userEvent.setup()
  render(<CreateCardDialog open onClose={vi.fn()} onCreated={vi.fn()} />)
  await user.type(screen.getByPlaceholderText('My playlist'), name)
  await user.click(screen.getByRole('button', { name: 'Create' }))
  await waitFor(() => expect(mockUpdateCard).toHaveBeenCalled())
  return mockUpdateCard.mock.calls[0]![0] as {
    content: Record<string, unknown>
    metadata: Record<string, unknown>
  }
}

describe('CreateCardDialog', () => {
  // AIDEV-NOTE: Regression test. The dialog sent `chapters: {}` and `version: 2`, and
  // Yoto rejected both:
  //   body.content.chapters: Invalid input: expected array, received object
  //   body.content.version:  Invalid input: expected string, received number
  // Types confirmed at yoto.dev/reference/card-content-schema.
  it('sends chapters as an array and version as a string', async () => {
    const payload = await createPlaylist()

    expect(Array.isArray(payload.content.chapters)).toBe(true)
    expect(typeof payload.content.version).toBe('string')
  })

  // AIDEV-NOTE: use-add-track merges {...defaults, ...existingContent}, so existing
  // content wins. A card created with activity 'none' and onlineOnly true kept those
  // for life and never downloaded to the player.
  it('matches the defaults used when adding a track', async () => {
    const payload = await createPlaylist()

    expect(payload.content.activity).toBe('yoto_Player')
    expect(payload.content.restricted).toBe(true)
    expect(payload.content.config).toMatchObject({ onlineOnly: false })
  })

  it('sets the title and omits the icon when none is chosen', async () => {
    const payload = await createPlaylist('Bedtime')

    expect(payload.metadata.title).toBe('Bedtime')
    expect(payload.metadata).not.toHaveProperty('icon')
  })
})
