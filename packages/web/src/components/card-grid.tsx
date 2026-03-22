import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import type { UserCard } from '@yotoplay/yoto-sdk'
import { useYotoQuery } from '../hooks/use-yoto-query'
import { ErrorState } from './error-state'
import { CardGridSkeleton } from './skeleton'
import '../styles/card-grid.css'

interface CardGridProps {
  onAddPlaylist?: () => void
}

// AIDEV-NOTE: Rotating card background colors per design spec
const CARD_COLORS = ['#6366F1', '#14B8A6', '#F59E0B', '#22C55E', '#EC4899', '#8B5CF6']

// AIDEV-NOTE: getMyCards() returns UserCard[] — a summary type with cardId, title, cover.
// It does NOT include metadata/content. Full card data is loaded in the editor via getCard().
export function CardGrid({ onAddPlaylist }: CardGridProps) {
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const {
    data: cards,
    loading,
    error,
    refetch,
  } = useYotoQuery<UserCard[]>((sdk) => sdk.content.getMyCards())

  if (!isAuthenticated) {
    return (
      <div className="card-grid-sign-in">
        <p>Sign in to see your cards</p>
        <button className="btn-primary" onClick={() => loginWithRedirect()}>
          Sign in
        </button>
      </div>
    )
  }

  if (error) {
    return <ErrorState message={`Failed to load cards: ${error}`} onRetry={refetch} />
  }

  if (loading || !cards) {
    return <CardGridSkeleton />
  }

  return (
    <div>
      <div className="card-grid-section-header">
        <h2>Your Cards</h2>
        <span className="card-grid-count">{cards.length}</span>
      </div>
      <div className="card-grid">
        {cards.map((card, index) => (
          <Link
            key={card.cardId}
            to={`/cards/${card.cardId}`}
            aria-label={card.title}
            className="card-grid-item"
            style={{ backgroundColor: CARD_COLORS[index % CARD_COLORS.length] }}
          >
            {card.cover?.imageS ? (
              <img src={card.cover.imageS} alt="" className="card-grid-image" />
            ) : (card as unknown as { metadata?: { icon?: string } }).metadata?.icon ? (
              <img
                src={(card as unknown as { metadata: { icon: string } }).metadata.icon}
                alt=""
                className="card-grid-image"
              />
            ) : null}
            <span className="card-grid-title">{card.title}</span>
          </Link>
        ))}
        <button onClick={onAddPlaylist} className="card-grid-add">
          <span className="card-grid-add-icon">+</span>
          <span>Add Playlist</span>
        </button>
      </div>
    </div>
  )
}
