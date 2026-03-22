import { useState } from 'react'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { useYotoQuery } from '../hooks/use-yoto-query'
import '../styles/icon-picker.css'

interface IconPickerProps {
  onSelect: (icon: DisplayIcon) => void
}

// AIDEV-NOTE: Icons fetched once via useYotoQuery — re-fetches only if SDK changes.
export function IconPicker({ onSelect }: IconPickerProps) {
  const { data: icons, loading } = useYotoQuery<DisplayIcon[]>((sdk) => sdk.icons.getDisplayIcons())
  const [search, setSearch] = useState('')

  if (loading || !icons) {
    return <p className="icon-picker-loading">Loading icons...</p>
  }

  const filtered = search
    ? icons.filter((icon) => icon.title.toLowerCase().includes(search.toLowerCase()))
    : icons

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search icons..."
        className="icon-picker-search"
      />
      <div className="icon-picker-grid">
        {filtered.map((icon) => (
          <button
            key={icon.url}
            onClick={() => onSelect(icon)}
            className="icon-picker-btn"
            title={icon.title}
          >
            <img src={icon.url} alt={icon.title} className="icon-picker-img" />
          </button>
        ))}
      </div>
    </div>
  )
}
