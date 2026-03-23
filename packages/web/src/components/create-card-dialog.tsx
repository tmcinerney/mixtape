import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { createCardApi } from '../api/client'
import '../styles/dialog.css'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

// AIDEV-NOTE: Creates a new empty card via the server's POST /api/cards endpoint.
// Single source of truth for card creation is yoto-cards.ts on the server.
export function CreateCardDialog({ open, onClose, onCreated }: CreateCardDialogProps) {
  const { getAccessTokenSilently } = useAuth0()
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleCreate = async () => {
    if (!title.trim()) return

    setCreating(true)
    setError(null)

    try {
      const token = await getAccessTokenSilently()
      await createCardApi(title.trim(), token)
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
