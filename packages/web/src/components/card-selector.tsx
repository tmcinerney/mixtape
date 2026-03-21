import { useYotoQuery } from '../hooks/use-yoto-query'
import { ErrorState } from './error-state'
import { Skeleton } from './skeleton'
import '../styles/card-selector.css'

interface Card {
  cardId: string
  title: string
}

interface CardSelectorProps {
  onSelect: (cardId: string) => void
  onCancel: () => void
}

// AIDEV-NOTE: This component is only rendered when the user is authenticated
// (the upload flow hook handles loginWithRedirect before reaching this point).
// It fetches cards from the Yoto SDK and renders a selection list.
export function CardSelector({ onSelect, onCancel }: CardSelectorProps) {
  const {
    data: cards,
    loading,
    error,
    refetch,
  } = useYotoQuery<Card[]>((sdk) => sdk.content.getMyCards())

  if (loading || !cards) {
    return (
      <div>
        <h3>Select a card</h3>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height="2.5em"
            radius="var(--radius-sm)"
            className="card-selector-skeleton"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return <ErrorState message={`Failed to load cards: ${error}`} onRetry={refetch} />
  }

  return (
    <div>
      <h3>Select a card</h3>
      {cards.length === 0 ? (
        <p>No cards found. Create one in the Yoto app first.</p>
      ) : (
        <ul className="card-selector-list">
          {cards.map((card) => (
            <li key={card.cardId} className="card-selector-item">
              <button className="card-selector-btn" onClick={() => onSelect(card.cardId)}>
                {card.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
