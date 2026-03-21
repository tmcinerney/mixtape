import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useYoto } from '../auth/yoto-provider'
import type { UserCard } from '@yotoplay/yoto-sdk'

interface CardGridProps {
  onAddPlaylist?: () => void
}

// AIDEV-NOTE: getMyCards() returns UserCard[] — a summary type with cardId, title, cover.
// It does NOT include metadata/content. Full card data is loaded in the editor via getCard().
export function CardGrid({ onAddPlaylist }: CardGridProps) {
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const { sdk, isReady } = useYoto()
  const [cards, setCards] = useState<UserCard[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isReady || !sdk) return

    let cancelled = false
    setLoading(true)

    sdk.content.getMyCards().then((result) => {
      if (!cancelled) {
        setCards(result)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [sdk, isReady])

  if (!isAuthenticated) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Sign in to see your cards</p>
        <button onClick={() => loginWithRedirect()}>Sign in</button>
      </div>
    )
  }

  if (loading) {
    return <div>Loading cards...</div>
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '1rem',
      }}
    >
      {cards.map((card) => (
        <Link
          key={card.cardId}
          to={`/cards/${card.cardId}`}
          aria-label={card.title}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            aspectRatio: '2 / 3',
            backgroundColor: '#6366F1',
            borderRadius: '0.5rem',
            padding: '1rem',
            textDecoration: 'none',
            color: 'white',
          }}
        >
          {card.cover?.imageS && (
            <img
              src={card.cover.imageS}
              alt=""
              style={{ width: 48, height: 48, marginBottom: '0.5rem' }}
            />
          )}
          <span style={{ fontWeight: 600, textAlign: 'center' }}>{card.title}</span>
        </Link>
      ))}
      <button
        onClick={onAddPlaylist}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '2 / 3',
          border: '2px dashed currentColor',
          borderRadius: '0.5rem',
          background: 'transparent',
          cursor: 'pointer',
          opacity: 0.6,
        }}
      >
        <span style={{ fontSize: '2rem' }}>+</span>
        <span>Add Playlist</span>
      </button>
    </div>
  )
}
