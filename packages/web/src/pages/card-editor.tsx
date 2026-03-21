import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useYoto } from '../auth/yoto-provider'
import { TrackList, type Track } from '../components/track-list'
import type { YotoJson } from '@yotoplay/yoto-sdk'

// AIDEV-NOTE: The SDK's YotoJson type is loosely typed (Record<string, unknown>).
// These interfaces represent the actual runtime shape of card data from the API.
// We cast through YotoJson at the SDK boundary.
interface ChapterData {
  title: string
  format: string
  channels: string
  type: string
  url: string
}

interface CardContent {
  activity: string
  editTracksDisabled: boolean
  chapters: Record<string, ChapterData>
  config: { onlineOnly: boolean }
  version: number
  restricted: boolean
}

interface CardData {
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
  const [title, setTitle] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // No automatic redirect — just gate on auth state in the render below

  useEffect(() => {
    if (!isReady || !sdk || !cardId) return

    let cancelled = false
    setLoading(true)

    sdk.content.getCard(cardId).then((result) => {
      if (!cancelled) {
        // AIDEV-NOTE: cast from loosely-typed YotoJson to our internal CardData
        const data = result as unknown as CardData
        setCard(data)
        setTitle(data.card.title)
        setTracks(chaptersToTracks(data.card.content.chapters))
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
    if (!sdk || !card) return

    setSaving(true)
    const updated: CardData = {
      card: {
        ...card.card,
        title,
        content: {
          ...card.card.content,
          chapters: tracksToChapters(tracks),
        },
      },
    }

    await sdk.content.updateCard(updated as unknown as YotoJson)
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

  return (
    <div style={layoutStyle}>
      {/* Left column: card preview */}
      <div style={leftColumnStyle}>
        <div style={{ ...previewBaseStyle, backgroundColor: card.card.metadata.color }}>
          {card.card.metadata.icon ? (
            <img src={card.card.metadata.icon} alt="Card icon" style={iconStyle} />
          ) : null}
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
