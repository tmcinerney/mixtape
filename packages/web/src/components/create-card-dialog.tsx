import { useRef, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import { useAuth } from '../auth/use-auth'
import { uploadCoverImage } from '../api/yoto-cover'
import { MYO_CARD_DEFAULTS, MYO_CONFIG_DEFAULTS } from '../lib/yoto-card'
import '../styles/dialog.css'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const MAX_COVER_BYTES = 5 * 1024 * 1024

// AIDEV-NOTE: Creates a playlist via SDK updateCard, which upserts when no cardId is
// present. Payload shape follows yoto.dev/reference/card-content-schema:
//   title                 top-level, REQUIRED (1-140 chars). NOT metadata.title —
//                         `title` does not exist in the metadata schema at all.
//   content.chapters      REQUIRED array
//   metadata.cover.imageL the card artwork, a plain URL from the cover upload endpoint
//
// This dialog used to offer the 16x16 track-icon picker and write `metadata.icon`.
// Both were wrong: icons represent tracks on the player, not the album, and
// `metadata.icon` is not a schema field. It now uploads a real cover image.
export function CreateCardDialog({ open, onClose, onCreated }: CreateCardDialogProps) {
  const { sdk } = useYoto()
  const { getAccessTokenSilently } = useAuth()
  const [title, setTitle] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const chooseCover = (file: File | undefined) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Pick an image file.')
      return
    }
    if (file.size > MAX_COVER_BYTES) {
      setError('That image is over 5 MB. Pick a smaller one.')
      return
    }
    setCoverFile(file)
    // AIDEV-NOTE: Object URL is revoked when the choice is replaced or cleared, so a
    // long-lived dialog cannot leak them.
    setCoverPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(file)
    })
  }

  const clearCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
    setCoverPreview(null)
    setCoverFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const reset = () => {
    setTitle('')
    clearCover()
    setError(null)
  }

  const handleCreate = async () => {
    if (!sdk || !title.trim()) return

    setCreating(true)
    setError(null)

    try {
      let coverUrl: string | null = null
      if (coverFile) {
        const token = await getAccessTokenSilently()
        coverUrl = (await uploadCoverImage(coverFile, token)).mediaUrl
      }

      await sdk.content.updateCard({
        title: title.trim(),
        content: {
          ...MYO_CARD_DEFAULTS,
          chapters: [],
          config: { ...MYO_CONFIG_DEFAULTS },
        },
        ...(coverUrl ? { metadata: { cover: { imageL: coverUrl } } } : {}),
      } as unknown as Parameters<typeof sdk.content.updateCard>[0])

      reset()
      onCreated()
    } catch (err) {
      // AIDEV-NOTE: Surface the failure. This used to leave `creating` stuck true, so
      // the button sat disabled at "Creating..." with no explanation and no way back.
      setError(err instanceof Error ? err.message : 'Could not create the playlist')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div role="dialog" aria-label="Create playlist" className="dialog-overlay">
      <div className="dialog-panel">
        <h2>Create Playlist</h2>

        <label className="dialog-label">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My playlist"
            maxLength={140}
            className="dialog-input"
          />
        </label>

        <div className="dialog-cover-section">
          <span className="dialog-label">Cover image (optional)</span>
          <p className="dialog-hint">
            Artwork for the playlist in the Yoto app. Track icons are chosen separately, per track.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="dialog-file-input"
            aria-label="Choose a cover image"
            onChange={(e) => chooseCover(e.target.files?.[0])}
          />

          {coverPreview ? (
            <div className="dialog-cover-preview-row">
              <img src={coverPreview} alt="Cover preview" className="dialog-cover-preview" />
              <button type="button" className="dialog-cover-clear" onClick={clearCover}>
                Remove
              </button>
            </div>
          ) : null}
        </div>

        {error ? (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="dialog-actions">
          <button className="btn-ghost" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={creating || !title.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
