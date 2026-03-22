import { useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import { IconPicker } from './icon-picker'
import type { DisplayIcon, YotoJson } from '@yotoplay/yoto-sdk'
import '../styles/dialog.css'

interface CreateCardDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

// AIDEV-NOTE: Creates a new card via SDK updateCard with sensible defaults for
// device playback. The card starts with no chapters — user adds tracks later via
// the card editor. The SDK doesn't have a dedicated createCard method, so we use
// updateCard which performs an upsert when no cardId is present.
export function CreateCardDialog({ open, onClose, onCreated }: CreateCardDialogProps) {
  const { sdk } = useYoto()
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState<DisplayIcon | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)
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
        icon: icon?.url ?? '',
        color: '#6366F1',
      },
    }

    await sdk.content.updateCard(newCard)

    setTitle('')
    setIcon(null)
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
          />
        </label>

        <div className="dialog-icon-section">
          <button
            className="dialog-icon-trigger"
            onClick={() => setShowIconPicker(!showIconPicker)}
          >
            {icon ? (
              <>
                <img src={icon.url} alt={icon.title} className="dialog-icon-preview" />
                <span className="dialog-icon-name">{icon.title}</span>
              </>
            ) : (
              <span className="dialog-icon-placeholder">Choose icon</span>
            )}
          </button>
          {showIconPicker ? (
            <div>
              <IconPicker
                onSelect={(selected) => {
                  setIcon(selected)
                  setShowIconPicker(false)
                }}
                {...(title.trim() ? { trackTitle: title.trim() } : {})}
              />
            </div>
          ) : null}
        </div>

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
