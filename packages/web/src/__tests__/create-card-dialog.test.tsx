import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockUpdateCard = vi.fn()
const mockUploadCoverImage = vi.fn()

vi.mock('../auth/yoto-provider', () => ({
  useYoto: () => ({ sdk: { content: { updateCard: mockUpdateCard } }, isReady: true }),
}))

vi.mock('../auth/use-auth', () => ({
  useAuth: () => ({ getAccessTokenSilently: () => Promise.resolve('test-token') }),
}))

vi.mock('../api/yoto-cover', () => ({
  uploadCoverImage: (...args: unknown[]) => mockUploadCoverImage(...args),
}))

import { CreateCardDialog } from '../components/create-card-dialog'

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdateCard.mockResolvedValue(undefined)
  mockUploadCoverImage.mockResolvedValue({
    mediaId: 'cover-id',
    mediaUrl: 'https://card-content.example/pub/cover-id',
  })
  // jsdom does not implement these.
  URL.createObjectURL = vi.fn(() => 'blob:preview')
  URL.revokeObjectURL = vi.fn()
})

type Payload = {
  title?: string
  content: Record<string, unknown>
  metadata?: { cover?: { imageL?: string } }
}

async function create(name = 'Bedtime', file?: File) {
  const user = userEvent.setup()
  render(<CreateCardDialog open onClose={vi.fn()} onCreated={vi.fn()} />)
  await user.type(screen.getByPlaceholderText('My playlist'), name)
  if (file) {
    await user.upload(screen.getByLabelText('Choose a cover image'), file)
  }
  await user.click(screen.getByRole('button', { name: 'Create' }))
  await waitFor(() => expect(mockUpdateCard).toHaveBeenCalled())
  return mockUpdateCard.mock.calls[0]![0] as Payload
}

function jpeg(name = 'cover.jpg') {
  return new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' })
}

describe('CreateCardDialog', () => {
  // AIDEV-NOTE: Per yoto.dev/reference/card-content-schema, `title` is a REQUIRED
  // top-level field. It is not in the metadata schema at all, yet the dialog used to
  // set only metadata.title.
  it('puts the title at the top level, not in metadata', async () => {
    const payload = await create('Bedtime')

    expect(payload.title).toBe('Bedtime')
    // metadata is absent entirely when no cover is chosen, so there is nowhere for a
    // stray metadata.title to hide.
    expect(payload.metadata?.cover).toBeUndefined()
    expect(JSON.stringify(payload.metadata ?? {})).not.toContain('title')
  })

  // AIDEV-NOTE: The dialog sent `chapters: {}` and `version: 2`; Yoto rejected both.
  it('sends chapters as an array and version as a string', async () => {
    const payload = await create()

    expect(Array.isArray(payload.content.chapters)).toBe(true)
    expect(typeof payload.content.version).toBe('string')
  })

  // AIDEV-NOTE: use-add-track merges {...defaults, ...existingContent}, so a card born
  // with activity 'none' and onlineOnly true kept them for life and never downloaded.
  it('matches the defaults used when adding a track', async () => {
    const payload = await create()

    expect(payload.content.activity).toBe('yoto_Player')
    expect(payload.content.restricted).toBe(true)
    expect(payload.content.config).toMatchObject({ onlineOnly: false })
  })

  // AIDEV-NOTE: The heart of it. Cover art is metadata.cover.imageL, a plain URL from
  // the cover endpoint — never a 16x16 track icon and never metadata.icon.
  it('uploads the chosen cover and stores its URL at metadata.cover.imageL', async () => {
    const file = jpeg()
    const payload = await create('Bedtime', file)

    expect(mockUploadCoverImage).toHaveBeenCalledWith(file, 'test-token')
    expect(payload.metadata?.cover?.imageL).toBe('https://card-content.example/pub/cover-id')
    expect(payload.metadata).not.toHaveProperty('icon')
  })

  it('omits metadata entirely when no cover is chosen', async () => {
    const payload = await create('Bedtime')

    expect(mockUploadCoverImage).not.toHaveBeenCalled()
    expect(payload.metadata).toBeUndefined()
  })

  it('reports a failure instead of hanging on "Creating..."', async () => {
    mockUpdateCard.mockRejectedValue(new Error('bad-request: chapters'))
    const user = userEvent.setup()
    render(<CreateCardDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('My playlist'), 'Bedtime')
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('bad-request: chapters')
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
  })

  it('rejects a non-image file without calling the API', async () => {
    const user = userEvent.setup()
    render(<CreateCardDialog open onClose={vi.fn()} onCreated={vi.fn()} />)

    await user.type(screen.getByPlaceholderText('My playlist'), 'Bedtime')
    // AIDEV-NOTE: fireEvent, not user.upload — user-event honours the accept="image/*"
    // attribute and drops the file before the component sees it, so the component's own
    // guard would never run. A real browser can still hand over a mistyped file.
    const input = screen.getByLabelText('Choose a cover image') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['nope'], 'notes.txt', { type: 'text/plain' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('Pick an image file')
    expect(mockUploadCoverImage).not.toHaveBeenCalled()
  })
})
