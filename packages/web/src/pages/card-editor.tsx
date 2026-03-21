import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useYoto } from '../auth/yoto-provider'
import { TrackList, type Track } from '../components/track-list'

// AIDEV-NOTE: Actual shape returned by sdk.content.getCard() — the SDK
// unwraps the { card: ... } wrapper from the raw API response.
interface CardData {
  cardId: string
  title: string
  metadata: Record<string, unknown>
  content: Record<string, unknown>
}

interface Chapter {
  key: string
  title?: string
  tracks: {
    key: string
    trackUrl: string
    format: string
    channels: string
    type: string
    title?: string
    duration?: number
    [k: string]: unknown
  }[]
  [k: string]: unknown
}

// AIDEV-NOTE: Convert chapters array to flat track list for the UI.
// Each chapter becomes one "track" — we use the first track's URL.
function chaptersToTracks(chapters: Chapter[]): Track[] {
  return chapters.map((ch) => {
    const firstTrack = ch.tracks[0]
    return {
      key: ch.key,
      title: ch.title ?? firstTrack?.title ?? 'Untitled',
      trackUrl: firstTrack?.trackUrl ?? '',
      format: firstTrack?.format ?? 'opus',
      channels: firstTrack?.channels ?? 'stereo',
      type: firstTrack?.type ?? 'audio',
      ...(firstTrack?.duration !== undefined ? { duration: firstTrack.duration } : {}),
    }
  })
}

// AIDEV-NOTE: Convert flat track list back to chapters array for the API.
// Each track becomes a chapter with a single-element tracks array.
function tracksToChapters(tracks: Track[], originalChapters: Chapter[]): Chapter[] {
  return tracks.map((t, i) => {
    // Preserve original chapter data (display, ambient, etc) if it exists
    const original = originalChapters.find((ch) => ch.key === t.key)
    const key = String(i).padStart(2, '0')
    return {
      ...original,
      key,
      title: t.title,
      overlayLabel: String(i + 1),
      tracks: [
        {
          ...(original?.tracks[0] ?? {}),
          key: '01',
          trackUrl: t.trackUrl,
          format: t.format,
          channels: t.channels,
          type: t.type,
          title: t.title,
          overlayLabel: String(i + 1),
        },
      ],
    }
  })
}

const layoutStyle: React.CSSProperties = { display: 'flex', gap: '2rem', flexWrap: 'wrap' }
const leftColumnStyle: React.CSSProperties = { flex: '0 0 200px' }

const previewBaseStyle: React.CSSProperties = {
  aspectRatio: '2 / 3',
  borderRadius: '0.5rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  marginBottom: '1rem',
}

const iconStyle: React.CSSProperties = { width: 64, height: 64, marginBottom: '0.5rem' }
const titleInputStyle: React.CSSProperties = { width: '100%', fontSize: '1.1rem', fontWeight: 600 }
const rightColumnStyle: React.CSSProperties = { flex: 1, minWidth: 300 }
const buttonGroupStyle: React.CSSProperties = { display: 'flex', gap: '0.5rem', marginTop: '1rem' }

export function CardEditor() {
  const { cardId } = useParams<{ cardId: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0()
  const { sdk, isReady } = useYoto()
  const [card, setCard] = useState<CardData | null>(null)
  const [originalChapters, setOriginalChapters] = useState<Chapter[]>([])
  const [title, setTitle] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isReady || !sdk || !cardId) return

    let cancelled = false
    setLoading(true)

    sdk.content.getCard(cardId).then((result) => {
      if (!cancelled) {
        // AIDEV-NOTE: SDK returns flat { cardId, title, content, metadata }
        const data = result as unknown as CardData
        const chapters = (data.content?.chapters ?? []) as unknown as Chapter[]
        setCard(data)
        setOriginalChapters(chapters)
        setTitle(data.title)
        setTracks(chaptersToTracks(chapters))
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
      return next.map((t, i) => ({ ...t, key: String(i).padStart(2, '0') }))
    })
  }, [])

  const handleSave = async () => {
    if (!sdk || !card || !cardId) return

    setSaving(true)
    // AIDEV-NOTE: merge onto existing card data, include cardId for update
    const payload = {
      ...card,
      cardId,
      title,
      content: {
        ...card.content,
        chapters: tracksToChapters(tracks, originalChapters),
      },
    }

    await sdk.content.updateCard(payload as unknown as Parameters<typeof sdk.content.updateCard>[0])
    setSaving(false)
    navigate('/')
  }

  if (authLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Sign in to edit cards</p>
        <button onClick={() => loginWithRedirect()}>Sign in</button>
      </div>
    )
  }

  if (loading) {
    return <div>Loading card...</div>
  }

  if (!card) {
    return <div>Card not found</div>
  }

  const metadata = card.metadata as { icon?: string; color?: string }

  return (
    <div style={layoutStyle}>
      {/* Left column: card preview */}
      <div style={leftColumnStyle}>
        <div style={{ ...previewBaseStyle, backgroundColor: metadata.color ?? '#6366F1' }}>
          {metadata.icon ? <img src={metadata.icon} alt="Card icon" style={iconStyle} /> : null}
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Card title"
          style={titleInputStyle}
        />
        <button style={{ marginTop: '0.5rem' }}>Change icon</button>
      </div>

      {/* Right column: track list */}
      <div style={rightColumnStyle}>
        <h2>Tracks</h2>
        <TrackList
          tracks={tracks}
          onReorder={setTracks}
          onDelete={handleDelete}
          onTitleChange={handleTitleChange}
        />

        <div style={buttonGroupStyle}>
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
