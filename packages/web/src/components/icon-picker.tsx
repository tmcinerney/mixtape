import { useCallback, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { useIcons } from '../hooks/use-icons'
import { suggestIcon } from '../api/client'
import '../styles/icon-picker.css'

interface IconPickerProps {
  onSelect: (icon: DisplayIcon) => void
  /** Track title for AI-powered icon suggestion */
  trackTitle?: string
}

// AIDEV-NOTE: Icons fetched once via useYotoQuery — re-fetches only if SDK changes.
// The optional trackTitle enables the "auto-match" button which uses semantic search
// via local embeddings on the server to find the best icon for the track.
export function IconPicker({ onSelect, trackTitle }: IconPickerProps) {
  const { icons, loading } = useIcons()
  const { getAccessTokenSilently } = useAuth0()
  const [search, setSearch] = useState('')
  const [suggesting, setSuggesting] = useState(false)

  const handleAutoMatch = useCallback(async () => {
    if (!trackTitle || !icons) return

    setSuggesting(true)
    try {
      const token = await getAccessTokenSilently()
      const match = await suggestIcon(trackTitle, token)
      if (match) {
        // Find the full DisplayIcon from our loaded list
        const icon = icons.find((i) => i.mediaId === match.mediaId)
        if (icon) {
          onSelect(icon)
          return
        }
      }
    } catch {
      // Fall through — auto-match failed silently
    } finally {
      setSuggesting(false)
    }
  }, [trackTitle, icons, getAccessTokenSilently, onSelect])

  if (loading || !icons) {
    return <p className="icon-picker-loading">Loading icons...</p>
  }

  const filtered = search
    ? icons.filter((icon) => (icon.title ?? '').toLowerCase().includes(search.toLowerCase()))
    : icons

  return (
    <div>
      <div className="icon-picker-toolbar">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search icons..."
          className="icon-picker-search"
        />
        {trackTitle ? (
          <button
            className="icon-picker-auto-btn"
            onClick={handleAutoMatch}
            disabled={suggesting}
            title={`Find icon for "${trackTitle}"`}
            aria-label="Auto-match icon"
          >
            {suggesting ? '...' : '✨'}
          </button>
        ) : null}
      </div>
      <div className="icon-picker-grid">
        {filtered.map((icon) => (
          <button
            key={icon.displayIconId}
            onClick={() => onSelect(icon)}
            className="icon-picker-btn"
            title={icon.title}
          >
            <img src={icon.url} alt={icon.title ?? ''} className="icon-picker-img" />
          </button>
        ))}
      </div>
    </div>
  )
}
