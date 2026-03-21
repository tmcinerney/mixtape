// AIDEV-NOTE: Track type represents a chapter entry from the Yoto card JSON.
// The key is the zero-padded chapter index (e.g. "00", "01").
export interface Track {
  key: string
  title: string
  format: string
  channels: string
  type: string
  url: string
  duration?: number
}

interface TrackListProps {
  tracks: Track[]
  onReorder: (tracks: Track[]) => void
  onDelete: (index: number) => void
  onTitleChange: (index: number, title: string) => void
}

export function TrackList({ tracks, onReorder, onDelete, onTitleChange }: TrackListProps) {
  const moveUp = (index: number) => {
    if (index === 0) return
    const next = [...tracks]
    const temp = next[index - 1]!
    next[index - 1] = next[index]!
    next[index] = temp
    // AIDEV-NOTE: re-key chapters with zero-padded two-digit keys after reorder
    onReorder(rekey(next))
  }

  const moveDown = (index: number) => {
    if (index === tracks.length - 1) return
    const next = [...tracks]
    const temp = next[index]!
    next[index] = next[index + 1]!
    next[index + 1] = temp
    onReorder(rekey(next))
  }

  return (
    <div role="list" aria-label="Track list">
      {tracks.map((track, i) => (
        <div
          key={track.key}
          role="listitem"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {i > 0 && (
              <button
                onClick={() => moveUp(i)}
                aria-label="Move up"
                style={{ fontSize: '0.75rem' }}
              >
                ▲
              </button>
            )}
            {i < tracks.length - 1 && (
              <button
                onClick={() => moveDown(i)}
                aria-label="Move down"
                style={{ fontSize: '0.75rem' }}
              >
                ▼
              </button>
            )}
          </div>
          <span style={{ minWidth: '2ch', textAlign: 'right', opacity: 0.5 }}>{i + 1}</span>
          <input
            type="text"
            value={track.title}
            onChange={(e) => onTitleChange(i, e.target.value)}
            aria-label="Track title"
            style={{ flex: 1 }}
          />
          <button onClick={() => onDelete(i)} aria-label="Delete track">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}

// AIDEV-NOTE: re-assign zero-padded two-digit keys ("00", "01", ...) after reorder
function rekey(tracks: Track[]): Track[] {
  return tracks.map((t, i) => ({
    ...t,
    key: String(i).padStart(2, '0'),
  }))
}
