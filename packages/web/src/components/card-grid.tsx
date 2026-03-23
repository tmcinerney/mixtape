import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
// AIDEV-NOTE: loginWithRedirect removed — sign-in now handled by header button
import { useYotoQuery } from '../hooks/use-yoto-query'
import { ErrorState } from './error-state'
import { CardGridSkeleton } from './skeleton'
import '../styles/card-grid.css'

// AIDEV-NOTE: The SDK's UserCard type only exposes top-level cover.imageS/M/L,
// but the actual content/mine API response includes metadata.cover.imageL for
// MYO cards. We use this extended type to access the real cover images.
interface CardWithMetadata {
  cardId: string
  title: string
  cover?: { imageS?: string; imageM?: string; imageL?: string }
  metadata?: { cover?: { imageL?: string } }
}

interface CardGridProps {
  onAddPlaylist?: () => void
}

// AIDEV-NOTE: Rotating card background colors per design spec
const CARD_COLORS = ['#6366F1', '#14B8A6', '#F59E0B', '#22C55E', '#EC4899', '#8B5CF6']

function getCardImage(card: CardWithMetadata): string | undefined {
  return (
    card.cover?.imageL ?? card.cover?.imageM ?? card.cover?.imageS ?? card.metadata?.cover?.imageL
  )
}

export function CardGrid({ onAddPlaylist }: CardGridProps) {
  const { isAuthenticated } = useAuth0()
  const {
    data: cards,
    loading,
    error,
    refetch,
  } = useYotoQuery<CardWithMetadata[]>((sdk) => sdk.content.getMyCards())

  // AIDEV-NOTE: When logged out, hide cards section entirely. Sign-in is
  // handled by the header button or triggered when user submits a URL.
  if (!isAuthenticated) {
    return null
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
            {getCardImage(card) ? (
              <img src={getCardImage(card)} alt="" className="card-grid-image" />
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
