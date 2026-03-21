import { useEffect, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useYoto } from '../auth/yoto-provider'

interface Card {
  cardId: string
  title: string
}

interface CardSelectorProps {
  onSelect: (cardId: string) => void
  onCancel: () => void
}

// AIDEV-NOTE: triggers loginWithRedirect if user is not authenticated.
// Once authenticated, fetches cards from Yoto SDK and renders a list.
export function CardSelector({ onSelect, onCancel }: CardSelectorProps) {
  const { isAuthenticated, loginWithRedirect } = useAuth0()
  const { sdk, isReady } = useYoto()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      loginWithRedirect()
      return
    }

    if (!isReady || !sdk) return

    let cancelled = false
    // AIDEV-NOTE: SDK method is content.getMyCards(), returns UserCard[] directly
    sdk.content
      .getMyCards()
      .then((result: Card[]) => {
        if (!cancelled) {
          setCards(result)
          setLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isReady, sdk, loginWithRedirect])

  if (!isAuthenticated) {
    return <p>Redirecting to login...</p>
  }

  if (loading) {
    return <p>Loading your cards...</p>
  }

  if (error) {
    return <p>Failed to load cards: {error}</p>
  }

  return (
    <div>
      <h3>Select a card</h3>
      {cards.length === 0 ? (
        <p>No cards found. Create one in the Yoto app first.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {cards.map((card) => (
            <li key={card.cardId} style={{ marginBottom: '0.5rem' }}>
              <button
                onClick={() => onSelect(card.cardId)}
                style={{ width: '100%', textAlign: 'left', padding: '0.5rem' }}
              >
                {card.title}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}
