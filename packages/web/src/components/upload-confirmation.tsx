interface UploadConfirmationProps {
  cardName: string
  trackTitle: string
  cardId: string
  onViewCard: (cardId: string) => void
  onAddAnother: () => void
}

export function UploadConfirmation({
  cardName,
  trackTitle,
  cardId,
  onViewCard,
  onAddAnother,
}: UploadConfirmationProps) {
  return (
    <div style={{ textAlign: 'center', padding: '2rem' }}>
      <h2>Track added!</h2>
      <p>
        <strong>{trackTitle}</strong> has been added to <strong>{cardName}</strong>.
      </p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
        <button onClick={() => onViewCard(cardId)}>View Card</button>
        <button onClick={onAddAnother}>Add Another</button>
      </div>
    </div>
  )
}
