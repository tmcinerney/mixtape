import { useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { createCardApi } from '../api/client'
import '../styles/dialog.css'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (cardId: string) => void
}

// AIDEV-NOTE: 22 images × 8 colors = 176 covers on Yoto CDN.
// Same set used by cover-matcher.ts on the server.
const COVER_IMAGES = [
  'apple',
  'bee',
  'book',
  'cactus',
  'cat-keytar',
  'cherries',
  'cloud',
  'diamond',
  'drum',
  'fish',
  'flower',
  'ghost',
  'ice-cream',
  'lolly',
  'microphone',
  'radio',
  'rocket',
  'skull',
  'star',
  'strawberry',
  'sun',
  'unicorn',
]
const COVER_COLORS = ['blue', 'grapefruit', 'green', 'lilac', 'mint', 'orange', 'red', 'yellow']

function randomCoverUrl(): string {
  const img = COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)]!
  const clr = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]!
  return `https://cdn.yoto.io/myo-cover/${img}_${clr}.gif`
}

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
      const cardId = await createCardApi(title.trim(), token, randomCoverUrl())
      setTitle('')
      setCreating(false)
      onCreated(cardId)
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
