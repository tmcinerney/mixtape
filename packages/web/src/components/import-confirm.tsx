import { useState } from 'react'
import type { MetadataResponse } from '@mixtape/shared'
import '../styles/import-confirm.css'

interface ImportConfirmProps {
  metadata: MetadataResponse
  onConfirm: (params: {
    cardId?: string
    cardTitle?: string
    coverUrl?: string
    tracks: Array<{ videoId: string; title: string }>
  }) => void
  onCancel: () => void
  onRefreshCovers: (title: string) => Promise<string[]>
}

// AIDEV-NOTE: Formats seconds into human-readable duration (e.g., "1h 2m")
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function ImportConfirm({
  metadata,
  onConfirm,
  onCancel,
  onRefreshCovers,
}: ImportConfirmProps) {
  const isPlaylist = metadata.tracks.length > 1
  const [cardTitle, setCardTitle] = useState(metadata.suggestedTitle)
  const [coverIdx, setCoverIdx] = useState(0)
  const [coverOptions, setCoverOptions] = useState(metadata.coverOptions)
  // AIDEV-NOTE: Single-track view has editable track title
  const [trackTitle, setTrackTitle] = useState(
    isPlaylist ? '' : (metadata.tracks[0]?.suggestedTitle ?? ''),
  )

  const coverUrl = coverOptions[coverIdx] ?? ''

  async function cycleCover() {
    const nextIdx = coverIdx + 1
    if (nextIdx < coverOptions.length) {
      setCoverIdx(nextIdx)
    } else {
      // Exhausted local options — fetch more
      const fresh = await onRefreshCovers(cardTitle)
      if (fresh.length > 0) {
        setCoverOptions((prev) => [...prev, ...fresh])
        setCoverIdx(nextIdx)
      } else {
        // Wrap around
        setCoverIdx(0)
      }
    }
  }

  function handleConfirm() {
    if (isPlaylist) {
      onConfirm({
        cardTitle,
        coverUrl,
        tracks: metadata.tracks.map((t) => ({ videoId: t.videoId, title: t.title })),
      })
    } else {
      onConfirm({
        cardTitle,
        coverUrl,
        tracks: [{ videoId: metadata.tracks[0]!.videoId, title: trackTitle }],
      })
    }
  }

  return (
    <div className="import-confirm">
      <div className="import-confirm-cover">
        {coverUrl && <img className="import-confirm-cover-img" src={coverUrl} alt="Card cover" />}
        <button
          className="btn-ghost import-confirm-cover-cycle"
          onClick={cycleCover}
          aria-label="Next cover"
        >
          &#x1f504;
        </button>
      </div>

      <label className="import-confirm-field">
        <span className="import-confirm-label">Card Title</span>
        <input
          className="import-confirm-input"
          type="text"
          value={cardTitle}
          onChange={(e) => setCardTitle(e.target.value)}
        />
      </label>

      {isPlaylist ? (
        <div className="import-confirm-playlist">
          <p className="import-confirm-meta">
            {metadata.tracks.length} tracks &middot; {formatDuration(metadata.totalDuration)}
          </p>

          {metadata.truncatedAt != null && (
            <p className="import-confirm-warning">
              Playlist was truncated at {metadata.truncatedAt} tracks.
            </p>
          )}

          <ul className="import-confirm-tracklist" role="list">
            {metadata.tracks.map((t, i) => (
              <li key={t.videoId} className="import-confirm-track">
                <span className="import-confirm-track-num">{i + 1}</span>
                <span className="import-confirm-track-title">{t.title}</span>
                <span className="import-confirm-track-dur">{formatDuration(t.duration)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <label className="import-confirm-field">
          <span className="import-confirm-label">Track Title</span>
          <input
            className="import-confirm-input"
            type="text"
            value={trackTitle}
            onChange={(e) => setTrackTitle(e.target.value)}
          />
        </label>
      )}

      <div className="import-confirm-actions">
        <button className="btn-primary" onClick={handleConfirm}>
          {isPlaylist ? `Import ${metadata.tracks.length} Tracks` : 'Create & Add'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}
