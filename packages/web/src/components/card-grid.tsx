import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { useYoto } from '../auth/yoto-provider'
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

// AIDEV-NOTE: Two-click delete — first click shows confirm, auto-resets after 3s.
// Same pattern as the track delete in card-editor.
function useDeleteCard(onDeleted: () => void) {
  const { sdk } = useYoto()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const requestDelete = useCallback(
    (cardId: string) => {
      if (pendingId === cardId) {
        // Second click — confirm
        setDeleting(true)
        sdk?.content
          .deleteCard(cardId)
          .then(() => {
            setPendingId(null)
            setDeleting(false)
            onDeleted()
          })
          .catch(() => {
            setPendingId(null)
            setDeleting(false)
          })
      } else {
        // First click — show confirm
        setPendingId(cardId)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setPendingId(null), 3000)
      }
    },
    [pendingId, sdk, onDeleted],
  )

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return { pendingId, deleting, requestDelete }
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
  const { pendingId, deleting, requestDelete } = useDeleteCard(refetch)

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
          <div key={card.cardId} className="card-grid-wrapper">
            <Link
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
            <button
              className={`card-grid-delete ${pendingId === card.cardId ? 'card-grid-delete--confirm' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                requestDelete(card.cardId)
              }}
              disabled={deleting}
              aria-label={
                pendingId === card.cardId ? `Confirm delete ${card.title}` : `Delete ${card.title}`
              }
            >
              {pendingId === card.cardId ? 'Delete?' : '×'}
            </button>
          </div>
        ))}
        <button onClick={onAddPlaylist} className="card-grid-add">
          <span className="card-grid-add-icon">+</span>
          <span>Add Playlist</span>
        </button>
      </div>
    </div>
  )
}
