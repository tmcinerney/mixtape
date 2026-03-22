import type { SaveStatus } from '../hooks/use-card-editor'
import '../styles/save-status.css'

interface SaveStatusProps {
  status: SaveStatus
  error?: string | null
  onRetry?: () => void
}

export function SaveStatusIndicator({ status, error, onRetry }: SaveStatusProps) {
  if (status === 'idle') return null

  return (
    <div className={`save-status save-status--${status}`} role="status" aria-live="polite">
      {status === 'saving' ? <span className="save-status-text">Saving...</span> : null}
      {status === 'saved' ? <span className="save-status-text">Saved</span> : null}
      {status === 'error' ? (
        <>
          <span className="save-status-text">{error ?? 'Failed to save'}</span>
          {onRetry ? (
            <button className="save-status-retry" onClick={onRetry}>
              Retry
            </button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
