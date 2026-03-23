import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth0 } from '@auth0/auth0-react'
import { deleteCardApi } from '../api/client'
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

// AIDEV-NOTE: Two-click delete with visual states:
// idle → confirming (red pill, 3s timeout) → deleting (spinner) → removed (fade-out) → refetch
// On error: flash red then reset. Uses server API, not SDK directly.
type DeleteState = 'idle' | 'confirming' | 'deleting' | 'removed' | 'error'

function useDeleteCard(onDeleted: () => void) {
  const { getAccessTokenSilently } = useAuth0()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [state, setDeleteState] = useState<DeleteState>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const requestDelete = useCallback(
    (cardId: string) => {
      if (activeId === cardId && state === 'confirming') {
        // Second click — execute delete
        setDeleteState('deleting')
        clearTimeout(timerRef.current)
        getAccessTokenSilently()
          .then((token) => deleteCardApi(cardId, token))
          .then(() => {
            setDeleteState('removed')
            timerRef.current = setTimeout(() => {
              setActiveId(null)
              setDeleteState('idle')
              onDeleted()
            }, 400)
          })
          .catch(() => {
            setDeleteState('error')
            timerRef.current = setTimeout(() => {
              setActiveId(null)
              setDeleteState('idle')
            }, 1500)
          })
      } else {
        // First click — show confirm
        setActiveId(cardId)
        setDeleteState('confirming')
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          setActiveId(null)
          setDeleteState('idle')
        }, 3000)
      }
    },
    [activeId, state, getAccessTokenSilently, onDeleted],
  )

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const getCardState = useCallback(
    (cardId: string): DeleteState => (activeId === cardId ? state : 'idle'),
    [activeId, state],
  )

  return { getCardState, requestDelete }
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
  const { getCardState, requestDelete } = useDeleteCard(refetch)

  if (!isAuthenticated) {
    return null
  }

  if (error) {
    return <ErrorState message={`Failed to load cards: ${error}`} onRetry={refetch} />
  }

  // AIDEV-NOTE: Only show skeleton on initial load, not during refetch.
  // Keeps existing cards visible while refreshing after delete/create.
  if (!cards && loading) {
    return <CardGridSkeleton />
  }

  if (!cards) {
    return null
  }

  return (
    <div>
      <div className="card-grid-section-header">
        <h2>Your Cards</h2>
        <span className="card-grid-count">{cards.length}</span>
      </div>
      <div className="card-grid">
        {cards.map((card, index) => {
          const deleteState = getCardState(card.cardId)
          const wrapperClass = [
            'card-grid-wrapper',
            deleteState === 'deleting' && 'card-grid-wrapper--deleting',
            deleteState === 'removed' && 'card-grid-wrapper--removed',
            deleteState === 'error' && 'card-grid-wrapper--error',
          ]
            .filter(Boolean)
            .join(' ')

          const buttonLabel =
            deleteState === 'confirming'
              ? 'Delete?'
              : deleteState === 'deleting'
                ? '...'
                : deleteState === 'error'
                  ? 'Failed'
                  : '×'

          const buttonClass = [
            'card-grid-delete',
            deleteState === 'confirming' && 'card-grid-delete--confirm',
            deleteState === 'deleting' && 'card-grid-delete--confirm card-grid-delete--deleting',
            deleteState === 'error' && 'card-grid-delete--confirm card-grid-delete--error',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div key={card.cardId} className={wrapperClass}>
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
                className={buttonClass}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (deleteState !== 'deleting' && deleteState !== 'removed') {
                    requestDelete(card.cardId)
                  }
                }}
                disabled={deleteState === 'deleting' || deleteState === 'removed'}
                aria-label={
                  deleteState === 'confirming'
                    ? `Confirm delete ${card.title}`
                    : `Delete ${card.title}`
                }
              >
                {buttonLabel}
              </button>
            </div>
          )
        })}
        <button onClick={onAddPlaylist} className="card-grid-add">
          <span className="card-grid-add-icon">+</span>
          <span>Add Playlist</span>
        </button>
      </div>
    </div>
  )
}
