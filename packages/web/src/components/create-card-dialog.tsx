import { useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { YotoJson } from '@yotoplay/yoto-sdk'
import '../styles/dialog.css'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

// AIDEV-NOTE: Creates a new empty card via SDK updateCard. Title only — no icon
// picker. Icons are per-track (set when adding tracks), not per-card.
export function CreateCardDialog({ open, onClose, onCreated }: CreateCardDialogProps) {
  const { sdk } = useYoto()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleCreate = async () => {
    if (!sdk || !title.trim()) return

    setCreating(true)
    setError(null)

    try {
      // AIDEV-NOTE: Use the same payload shape as our server-side createCard.
      // The SDK's updateCard sends POST /content which does an upsert.
      // Title must be top-level, not in metadata.
      const newCard = {
        title: title.trim(),
        content: {
          activity: 'yoto_Player',
          restricted: true,
          version: '1',
          chapters: [],
          config: { resumeTimeout: 2592000, onlineOnly: false },
        },
        metadata: {},
      }

      await sdk.content.updateCard(newCard as unknown as YotoJson)

      setTitle('')
      setCreating(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create card')
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
            className="dialog-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && title.trim()) handleCreate()
            }}
          />
        </label>

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--font-size-sm)' }}>{error}</p>
        )}

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
