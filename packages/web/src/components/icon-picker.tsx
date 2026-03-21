import { useEffect, useRef, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import '../styles/icon-picker.css'

interface IconPickerProps {
  onSelect: (icon: DisplayIcon) => void
}

// AIDEV-NOTE: Shared ref-based cache — icons are fetched once and reused
// across remounts without module-level mutable state. The promise ref
// prevents duplicate fetches from concurrent mounts.
export function IconPicker({ onSelect }: IconPickerProps) {
  const { sdk, isReady } = useYoto()
  const [icons, setIcons] = useState<DisplayIcon[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const fetchPromiseRef = useRef<Promise<DisplayIcon[]> | null>(null)

  useEffect(() => {
    if (!isReady || !sdk) return

    let cancelled = false

    // Reuse in-flight or completed fetch
    if (!fetchPromiseRef.current) {
      fetchPromiseRef.current = sdk.icons.getDisplayIcons()
    }

    fetchPromiseRef.current
      .then((result) => {
        if (!cancelled) {
          setIcons(result)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sdk, isReady])

  const filtered = search
    ? icons.filter((icon) => icon.title.toLowerCase().includes(search.toLowerCase()))
    : icons

  if (loading) {
    return <div>Loading icons...</div>
  }

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
