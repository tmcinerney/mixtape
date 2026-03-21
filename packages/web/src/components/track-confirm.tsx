import { useState } from 'react'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { IconPicker } from './icon-picker'
import type { ConfirmData } from '../hooks/use-upload-flow'
import '../styles/track-confirm.css'

const SOFT_LIMIT = 50
const HARD_LIMIT = 100

interface TrackConfirmProps {
  data: ConfirmData
  onConfirm: (title: string, iconUrl?: string) => void
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
    onConfirm(trimmed, icon?.url)
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
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setShowIconPicker(!showIconPicker)}
        >
          {icon ? `Icon: ${icon.title}` : 'Choose icon'}
        </button>
        {showIconPicker ? (
          <div className="track-confirm-icon-picker">
            <IconPicker
              onSelect={(selected) => {
                setIcon(selected)
                setShowIconPicker(false)
              }}
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
