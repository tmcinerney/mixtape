import '../styles/import-complete.css'

interface ImportCompleteProps {
  cardId: string
  imported: number
  total: number
  skipped: Array<{ title: string; reason: string }>
  cancelled?: boolean
  onViewCard: (cardId: string) => void
  onImportAnother: () => void
}

export function ImportComplete({
  cardId,
  imported,
  total,
  skipped,
  cancelled,
  onViewCard,
  onImportAnother,
}: ImportCompleteProps) {
  const isSingle = imported === 1 && total === 1 && !cancelled

  let heading: string
  if (isSingle) {
    heading = 'Track added!'
  } else if (cancelled) {
    heading = `Imported ${imported} tracks (cancelled)`
  } else {
    heading = `Imported ${imported}/${total} tracks`
  }

  return (
    <div className="import-complete">
      <h2>{heading}</h2>

      {skipped.length > 0 && (
        <div className="import-complete-skipped">
          <h3>Skipped</h3>
          <ul role="list">
            {skipped.map((s, i) => (
              <li key={i} className="import-complete-skipped-item">
                <span>{s.title}</span>
                <span className="import-complete-skipped-reason">{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="import-complete-actions">
        <button className="btn-primary" onClick={() => onViewCard(cardId)}>
          View Card
        </button>
        <button className="btn-secondary" onClick={onImportAnother}>
          Import Another
        </button>
      </div>
    </div>
  )
}
