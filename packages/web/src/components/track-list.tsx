import '../styles/track-list.css'

// AIDEV-NOTE: Each "track" in the UI represents a Yoto chapter.
// A chapter has a key, title, and a tracks array (usually one track per chapter).
// The first track's trackUrl is what the device plays.
export interface Track {
  key: string
  title: string
  trackUrl: string
  format: string
  channels: string
  type: string
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
        <div key={track.key} role="listitem" className="track-list-item">
          <div className="track-list-reorder">
            {i > 0 ? (
              <button
                onClick={() => moveUp(i)}
                aria-label="Move up"
                className="track-list-reorder-btn"
              >
                ▲
              </button>
            ) : null}
            {i < tracks.length - 1 ? (
              <button
                onClick={() => moveDown(i)}
                aria-label="Move down"
                className="track-list-reorder-btn"
              >
                ▼
              </button>
            ) : null}
          </div>
          <span className="track-list-number">{i + 1}</span>
          <input
            type="text"
            value={track.title}
            onChange={(e) => onTitleChange(i, e.target.value)}
            aria-label="Track title"
            className="track-list-title-input"
          />
          <button
            onClick={() => onDelete(i)}
            aria-label="Delete track"
            className="track-list-delete-btn"
          >
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
