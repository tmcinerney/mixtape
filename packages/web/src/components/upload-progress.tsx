import type { JobProgress } from '@mixtape/shared'

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
    <div>
      <p style={{ fontWeight: 600, marginBottom: '1rem' }}>{title}</p>
      <div
        style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}
        role="group"
        aria-label="Upload progress"
      >
        {STEPS.map((step, idx) => {
          const isCurrent = idx === activeIdx
          const isComplete = idx < activeIdx
          const label = step.charAt(0).toUpperCase() + step.slice(1)

          return (
            <div key={step} style={{ textAlign: 'center' }}>
              <span
                aria-current={isCurrent ? 'step' : undefined}
                style={{
                  fontWeight: isCurrent ? 700 : 400,
                  opacity: isComplete ? 0.5 : 1,
                }}
              >
                {label}
              </span>
              {isCurrent && percentage !== null ? (
                <div style={{ fontSize: '0.875rem' }}>{percentage}%</div>
              ) : null}
            </div>
          )
        })}
      </div>
      <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  )
}
