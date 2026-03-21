import '../styles/upload-confirmation.css'

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
    <div className="upload-confirmation">
      <h2>Track added!</h2>
      <p>
        <strong>{trackTitle}</strong> has been added to <strong>{cardName}</strong>.
      </p>
      <div className="upload-confirmation-actions">
        <button className="btn-primary" onClick={() => onViewCard(cardId)}>
          View Card
        </button>
        <button className="btn-secondary" onClick={onAddAnother}>
          Add Another
        </button>
      </div>
    </div>
  )
}
