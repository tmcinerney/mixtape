import { useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import { IconPicker } from './icon-picker'
import type { DisplayIcon, YotoJson } from '@yotoplay/yoto-sdk'
import { MYO_CARD_DEFAULTS, MYO_CONFIG_DEFAULTS } from '../lib/yoto-card'
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

    // AIDEV-NOTE: Shared defaults, deliberately. This used to carry its own copy with
    // `chapters: {}` and `version: 2`, which Yoto rejects, and with activity/config
    // values that disagreed with use-add-track — see lib/yoto-card.ts.
    const newCard: YotoJson = {
      content: {
        ...MYO_CARD_DEFAULTS,
        editTracksDisabled: false,
        chapters: [],
        config: { ...MYO_CONFIG_DEFAULTS },
      },
      metadata: {
        title: title.trim(),
        // AIDEV-NOTE: This is a 16x16 track icon, which is the wrong asset for a
        // playlist. Yoto's cover image is metadata.cover.imageL, uploaded via
        // /media/coverImage/user/me/upload. Left as-is for now because it still gives
        // the card grid a thumbnail; replacing it is a product decision, not a bug fix.
        ...(icon ? { icon: icon.url } : {}),
        color: '#6366F1',
      },
    }

    try {
      await sdk.content.updateCard(newCard)
    } finally {
      // AIDEV-NOTE: Previously a failed create left `creating` stuck true, so the
      // button stayed disabled at "Creating..." with no way back.
      setCreating(false)
    }

    setTitle('')
    setIcon(null)
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
