import { useState } from 'react'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { IconPicker } from './icon-picker'
import type { ConfirmData } from '../hooks/use-upload-flow'
import '../styles/track-confirm.css'

const SOFT_LIMIT = 50
const HARD_LIMIT = 100

interface TrackConfirmProps {
  data: ConfirmData
  onConfirm: (title: string, iconRef?: string) => void
  onCancel: () => void
}

export function TrackConfirm({ data, onConfirm, onCancel }: TrackConfirmProps) {
  const [title, setTitle] = useState(data.suggestedTitle)
  const [icon, setIcon] = useState<DisplayIcon | null>(null)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const isOverSoft = title.length > SOFT_LIMIT
  const isOverHard = title.length > HARD_LIMIT

  const handleTitleChange = (value: string) => {
    // Enforce hard limit on input
    if (value.length <= HARD_LIMIT) {
      setTitle(value)
    }
  }

  const handleConfirm = () => {
    const trimmed = title.trim()
    if (!trimmed) return
    // AIDEV-NOTE: Must be the `yoto:#{mediaId}` ref, NEVER icon.url. The Yoto API
    // rejects a plain URL here with 400: `icon16x16 must be in format
    // "yoto:#{mediaId}" where mediaId is 43 characters`. icon.url is for rendering
    // only — see use-icons.ts, which maps ref -> url for exactly that purpose.
    onConfirm(trimmed, icon ? `yoto:#${icon.mediaId}` : undefined)
  }

  const useOriginal = () => {
    setTitle(data.title)
  }

  return (
    <div className="track-confirm">
      <h3 className="track-confirm-heading">Add this track?</h3>

      <div className="track-confirm-field">
        <label htmlFor="track-title" className="track-confirm-label">
          Track name
        </label>
        <input
          id="track-title"
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm()
          }}
          className={`track-confirm-input ${isOverSoft ? 'track-confirm-input--warn' : ''}`}
          autoFocus
        />
        <div className="track-confirm-meta">
          <span
            className={`track-confirm-counter ${isOverSoft ? 'track-confirm-counter--warn' : ''} ${isOverHard ? 'track-confirm-counter--error' : ''}`}
          >
            {title.length}/{HARD_LIMIT}
          </span>
          {title !== data.title ? (
            <button type="button" className="track-confirm-original-btn" onClick={useOriginal}>
              Use original
            </button>
          ) : null}
        </div>
        {data.suggestedTitle !== data.title && title !== data.suggestedTitle ? (
          <button
            type="button"
            className="track-confirm-original-btn"
            onClick={() => setTitle(data.suggestedTitle)}
          >
            Use suggested
          </button>
        ) : null}
      </div>

      <div className="track-confirm-field">
        <span className="track-confirm-label">Icon (optional)</span>
        <div className="track-confirm-icon-row">
          <button
            type="button"
            className="btn-secondary track-confirm-icon-btn"
            onClick={() => setShowIconPicker(!showIconPicker)}
          >
            {/* AIDEV-NOTE: Show the icon itself, not just its name. These are the 16x16
                pixel-art icons that end up on the player, so the name alone tells the
                user very little about what they picked. */}
            {icon ? (
              <>
                <img src={icon.url} alt="" className="track-confirm-icon-preview" />
                <span>{icon.title}</span>
              </>
            ) : (
              'Choose icon'
            )}
          </button>
          {icon ? (
            <button
              type="button"
              className="track-confirm-icon-clear"
              onClick={() => setIcon(null)}
              aria-label="Remove icon"
            >
              Clear
            </button>
          ) : null}
        </div>
        {showIconPicker ? (
          <div className="track-confirm-icon-picker">
            <IconPicker
              onSelect={(selected) => {
                setIcon(selected)
                setShowIconPicker(false)
              }}
              trackTitle={title}
            />
          </div>
        ) : null}
      </div>

      <div className="track-confirm-actions">
        <button className="btn-primary" onClick={handleConfirm} disabled={!title.trim()}>
          Add Track
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
