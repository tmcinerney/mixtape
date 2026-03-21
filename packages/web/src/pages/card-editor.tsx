import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useYoto } from '../auth/yoto-provider'
import { TrackList, type Track } from '../components/track-list'

// AIDEV-NOTE: Mirrors Yoto card JSON structure for type safety in the editor
interface CardContent {
  activity: string
  editTracksDisabled: boolean
  chapters: Record<string, ChapterData>
  config: { onlineOnly: boolean }
  version: number
  restricted: boolean
}

interface ChapterData {
  title: string
  format: string
  channels: string
  type: string
  url: string
}

interface CardPayload {
  card: {
    cardId: string
    title: string
    metadata: { icon: string; color: string }
    content: CardContent
  }
}

function chaptersToTracks(chapters: Record<string, ChapterData>): Track[] {
  return Object.entries(chapters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, ch]) => ({
      key,
      title: ch.title,
      format: ch.format,
      channels: ch.channels,
      type: ch.type,
      url: ch.url,
    }))
}

function tracksToChapters(tracks: Track[]): Record<string, ChapterData> {
  const chapters: Record<string, ChapterData> = {}
  for (const t of tracks) {
    chapters[t.key] = {
      title: t.title,
      format: t.format,
      channels: t.channels,
      type: t.type,
      url: t.url,
    }
  }
  return chapters
}

export function CardEditor() {
  const { cardId } = useParams<{ cardId: string }>()
  const navigate = useNavigate()
  const { sdk, isReady } = useYoto()
  const [card, setCard] = useState<CardPayload | null>(null)
  const [title, setTitle] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isReady || !sdk || !cardId) return

    let cancelled = false
    setLoading(true)

    sdk.content.getCard(cardId).then((result: CardPayload) => {
      if (!cancelled) {
        setCard(result)
        setTitle(result.card.title)
        setTracks(chaptersToTracks(result.card.content.chapters))
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [sdk, isReady, cardId])

  const handleTitleChange = useCallback((index: number, newTitle: string) => {
    setTracks((prev) => prev.map((t, i) => (i === index ? { ...t, title: newTitle } : t)))
  }, [])

  const handleDelete = useCallback((index: number) => {
    setTracks((prev) => {
      const next = prev.filter((_, i) => i !== index)
      // re-key after deletion
      return next.map((t, i) => ({ ...t, key: String(i).padStart(2, '0') }))
    })
  }, [])

  const handleSave = async () => {
    if (!sdk || !card) return

    setSaving(true)
    const updated: CardPayload = {
      card: {
        ...card.card,
        title,
        content: {
          ...card.card.content,
          chapters: tracksToChapters(tracks),
        },
      },
    }

    await sdk.content.updateCard(updated)
    setSaving(false)
    navigate('/')
  }

  if (loading) {
    return <div>Loading card...</div>
  }

  if (!card) {
    return <div>Card not found</div>
  }

  return (
    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
      {/* Left column: card preview */}
      <div style={{ flex: '0 0 200px' }}>
        <div
          style={{
            aspectRatio: '2 / 3',
            backgroundColor: card.card.metadata.color,
            borderRadius: '0.5rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          {card.card.metadata.icon && (
            <img
              src={card.card.metadata.icon}
              alt="Card icon"
              style={{ width: 64, height: 64, marginBottom: '0.5rem' }}
            />
          )}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Card title"
          style={{ width: '100%', fontSize: '1.1rem', fontWeight: 600 }}
        />
        <button style={{ marginTop: '0.5rem' }}>Change icon</button>
      </div>

      {/* Right column: track list */}
      <div style={{ flex: 1, minWidth: 300 }}>
        <h2>Tracks</h2>
        <TrackList
          tracks={tracks}
          onReorder={setTracks}
          onDelete={handleDelete}
          onTitleChange={handleTitleChange}
        />

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button onClick={handleSave} disabled={saving} aria-label="Save">
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={() => navigate('/')} aria-label="Cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
