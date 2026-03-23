import { CassetteLoader } from './cassette-loader'
import '../styles/import-progress.css'

interface ImportProgressProps {
  currentTrack: number
  totalTracks: number
  currentTitle: string
  trackProgress: { step: string; progress: number } | null
  completedTracks: Array<{ title: string; status: 'done' | 'skipped'; reason?: string }>
  onCancel: () => void
}

const STEPS = ['download', 'upload', 'transcode'] as const

// AIDEV-NOTE: Maps backend step names to display labels
function stepLabel(step: string): string {
  if (step === 'download') return 'Downloading'
  if (step === 'upload') return 'Uploading'
  if (step === 'transcode') return 'Processing'
  return step
}

export function ImportProgress({
  currentTrack,
  totalTracks,
  currentTitle,
  trackProgress,
  completedTracks,
  onCancel,
}: ImportProgressProps) {
  const isMulti = totalTracks > 1

  // Per-track progress for cassette animation
  const activeIdx = trackProgress ? STEPS.indexOf(trackProgress.step as (typeof STEPS)[number]) : -1
  const trackPercent =
    activeIdx >= 0 && trackProgress
      ? Math.round(((activeIdx * 100 + trackProgress.progress) / (STEPS.length * 100)) * 100)
      : 0

  return (
    <div className="import-progress">
      <CassetteLoader progress={trackPercent} label={currentTitle} />

      {isMulti && (
        <p className="import-progress-counter">
          Track {currentTrack} of {totalTracks}
        </p>
      )}

      {trackProgress && (
        <div className="import-progress-steps" role="group" aria-label="Track progress">
          {STEPS.map((step) => {
            const idx = STEPS.indexOf(step)
            const isCurrent = idx === activeIdx
            const isComplete = idx < activeIdx

            let cls = 'import-progress-step'
            if (isCurrent) cls += ' import-progress-step--active'
            if (isComplete) cls += ' import-progress-step--complete'

            return (
              <span key={step} className={cls} aria-current={isCurrent ? 'step' : undefined}>
                {stepLabel(step)}
                {isCurrent && trackProgress ? ` ${trackProgress.progress}%` : ''}
              </span>
            )
          })}
        </div>
      )}

      {isMulti && completedTracks.length > 0 && (
        <ul className="import-progress-completed" role="list">
          {completedTracks.map((t, i) => (
            <li
              key={i}
              className={`import-progress-completed-item import-progress-completed-item--${t.status}`}
            >
              <span>{t.title}</span>
              {t.status === 'skipped' && t.reason && (
                <span className="import-progress-completed-reason">{t.reason}</span>
              )}
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
