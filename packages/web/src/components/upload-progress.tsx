import type { JobProgress } from '@mixtape/shared'
import '../styles/upload-progress.css'

const STEPS = ['download', 'convert', 'upload'] as const
type StepName = (typeof STEPS)[number]

// AIDEV-NOTE: transcode maps to the upload step in the 3-step UI
function mapStep(step: string): StepName | null {
  if (step === 'download') return 'download'
  if (step === 'convert') return 'convert'
  if (step === 'upload' || step === 'transcode') return 'upload'
  return null
}

interface UploadProgressProps {
  progress: JobProgress | null
  title: string
  onCancel: () => void
}

export function UploadProgress({ progress, title, onCancel }: UploadProgressProps) {
  const activeStep = progress ? mapStep(progress.step) : null
  const activeIdx = activeStep ? STEPS.indexOf(activeStep) : -1
  const percentage =
    progress && 'progress' in progress ? (progress as { progress: number }).progress : null

  return (
    <div className="upload-progress">
      <p className="upload-progress-title">{title}</p>
      <div className="upload-progress-steps" role="group" aria-label="Upload progress">
        {STEPS.map((step, idx) => {
          const isCurrent = idx === activeIdx
          const isComplete = idx < activeIdx
          const label = step.charAt(0).toUpperCase() + step.slice(1)

          let labelClass = 'upload-step-label'
          if (isCurrent) labelClass += ' upload-step-label--active'
          if (isComplete) labelClass += ' upload-step-label--complete'

          return (
            <div key={step} className="upload-step">
              <span aria-current={isCurrent ? 'step' : undefined} className={labelClass}>
                {label}
              </span>
              {isCurrent && percentage !== null ? (
                <div className="upload-step-percent">{percentage}%</div>
              ) : null}
            </div>
          )
        })}
      </div>
      <button className="btn-ghost" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}
