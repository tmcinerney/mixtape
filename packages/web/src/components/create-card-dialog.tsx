import { useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import { IconPicker } from './icon-picker'
import type { DisplayIcon, YotoJson } from '@yotoplay/yoto-sdk'

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
    <div
      role="dialog"
      aria-label="Create playlist"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'var(--bg, white)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          minWidth: 320,
          maxWidth: 480,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create Playlist</h2>

        <label style={{ display: 'block', marginBottom: '0.5rem' }}>
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="My playlist"
            style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
          />
        </label>

        <div style={{ marginBottom: '0.5rem' }}>
          <button onClick={() => setShowIconPicker(!showIconPicker)}>
            {icon ? `Icon: ${icon.title}` : 'Choose icon'}
          </button>
          {showIconPicker ? (
            <div style={{ marginTop: '0.5rem' }}>
              <IconPicker
                onSelect={(selected) => {
                  setIcon(selected)
                  setShowIconPicker(false)
                }}
              />
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating || !title.trim()}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
