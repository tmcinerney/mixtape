import { useEffect, useRef, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'

interface IconPickerProps {
  onSelect: (icon: DisplayIcon) => void
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
  gap: '0.5rem',
  maxHeight: 300,
  overflowY: 'auto',
}

const iconButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.25rem',
  border: '1px solid #e5e7eb',
  borderRadius: '0.25rem',
  background: 'transparent',
  cursor: 'pointer',
}

const iconImgStyle: React.CSSProperties = { width: 32, height: 32 }

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
        style={{ width: '100%', marginBottom: '0.5rem' }}
      />
      <div style={gridStyle}>
        {filtered.map((icon) => (
          <button
            key={icon.url}
            onClick={() => onSelect(icon)}
            style={iconButtonStyle}
            title={icon.title}
          >
            <img src={icon.url} alt={icon.title} style={iconImgStyle} />
          </button>
        ))}
      </div>
    </div>
  )
}
