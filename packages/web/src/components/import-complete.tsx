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
  const allFailed = imported === 0
  const hasSkipped = skipped.length > 0

  return (
    <div className="import-complete">
      {/* Status icon */}
      <div className={`import-complete-icon ${allFailed ? 'import-complete-icon--warning' : ''}`}>
        {allFailed ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <circle cx="12" cy="16" r="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Heading */}
      <h2 className="import-complete-heading">
        {isSingle ? (
          'Track added!'
        ) : cancelled ? (
          <>
            Imported {imported} {imported === 1 ? 'track' : 'tracks'}
            <span className="import-complete-cancelled"> (cancelled)</span>
          </>
        ) : allFailed ? (
          'Import failed'
        ) : (
          <>
            {imported}/{total} tracks imported
          </>
        )}
      </h2>

      {/* Subtitle */}
      {!allFailed && !isSingle && (
        <p className="import-complete-subtitle">Your card is ready to play.</p>
      )}

      {/* Skipped tracks */}
      {hasSkipped && (
        <div className="import-complete-skipped">
          <div className="import-complete-skipped-header">
            {skipped.length} {skipped.length === 1 ? 'track' : 'tracks'} skipped
          </div>
          <ul role="list">
            {skipped.map((s, i) => (
              <li key={i} className="import-complete-skipped-item">
                <span className="import-complete-skipped-title">{s.title}</span>
                <span className="import-complete-skipped-reason">{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="import-complete-actions">
        {!allFailed && (
          <button className="btn-primary" onClick={() => onViewCard(cardId)}>
            View Card
          </button>
        )}
        <button className={allFailed ? 'btn-primary' : 'btn-ghost'} onClick={onImportAnother}>
          {allFailed ? 'Try Again' : 'Import Another'}
        </button>
      </div>
    </div>
  )
}
