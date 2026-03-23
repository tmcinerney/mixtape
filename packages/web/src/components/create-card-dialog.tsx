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

  if (!open) return null

  const handleCreate = async () => {
    if (!sdk || !title.trim()) return

    setCreating(true)

    const newCard: YotoJson = {
      content: {
        activity: 'none',
        editTracksDisabled: false,
        chapters: {},
        config: { onlineOnly: true },
        version: 2,
        restricted: false,
      },
      metadata: {
        title: title.trim(),
        color: '#6366F1',
      },
    }

    await sdk.content.updateCard(newCard)

    setTitle('')
    setCreating(false)
    onCreated()
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
