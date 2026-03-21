import '../styles/error-state.css'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p className="error-state-message">{message}</p>
      {onRetry ? (
        <button className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
