import { useEffect, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'

interface IconPickerProps {
  onSelect: (icon: DisplayIcon) => void
}

// AIDEV-NOTE: module-level cache so icons survive re-renders and remounts.
// fetchStarted prevents duplicate fetches across concurrent mounts.
let cachedIcons: DisplayIcon[] | null = null
let fetchStarted = false

export function IconPicker({ onSelect }: IconPickerProps) {
  const { sdk, isReady } = useYoto()
  const [icons, setIcons] = useState<DisplayIcon[]>(cachedIcons ?? [])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(!cachedIcons)

  useEffect(() => {
    if (cachedIcons || fetchStarted || !isReady || !sdk) return

    fetchStarted = true
    setLoading(true)

    sdk.icons.getDisplayIcons().then((result) => {
      cachedIcons = result
      setIcons(result)
      setLoading(false)
    })
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
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
          gap: '0.5rem',
          maxHeight: 300,
          overflowY: 'auto',
        }}
      >
        {filtered.map((icon) => (
          <button
            key={icon.url}
            onClick={() => onSelect(icon)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.25rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.25rem',
              background: 'transparent',
              cursor: 'pointer',
            }}
            title={icon.title}
          >
            <img src={icon.url} alt={icon.title} style={{ width: 32, height: 32 }} />
          </button>
        ))}
      </div>
    </div>
  )
}

// AIDEV-NOTE: exported for testing — allows resetting the cache between tests
export function _resetIconCache() {
  cachedIcons = null
  fetchStarted = false
}
