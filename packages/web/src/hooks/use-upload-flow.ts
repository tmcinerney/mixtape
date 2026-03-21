import { useCallback, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import type { JobProgress } from '@mixtape/shared'
import { startJob, cancelJob } from '../api/client'

type FlowState = 'idle' | 'selecting-card' | 'uploading' | 'adding-track' | 'complete' | 'error'

interface UploadFlowOptions {
  // AIDEV-NOTE: called when SSE reports complete — the hook handles the
  // adding-track transition internally rather than exposing it as a state
  // the parent has to watch via useEffect (which caused infinite re-renders).
  onTrackReady: (mediaUrl: string, cardId: string) => Promise<void>
}

interface UploadFlowResult {
  state: FlowState
  youtubeUrl: string | null
  cardId: string | null
  progress: JobProgress | null
  error: string | null
  submitUrl: (url: string) => void
  selectCard: (cardId: string) => void
  cancel: () => void
  reset: () => void
}

export function useUploadFlow({ onTrackReady }: UploadFlowOptions): UploadFlowResult {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0()

  const [state, setState] = useState<FlowState>('idle')
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const streamRef = useRef<{ close: () => void } | null>(null)

  const submitUrl = useCallback((url: string) => {
    setYoutubeUrl(url)
    setState('selecting-card')
    setError(null)
  }, [])

  // AIDEV-NOTE: SSE event handling extracted from selectCard for clarity.
  // Called once the job stream is established — listens for progress/complete/error.
  const listenToStream = useCallback(
    (eventSource: EventTarget & { close: () => void }, selectedCardId: string) => {
      eventSource.addEventListener('progress', (event: Event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data as string) as JobProgress
          if (data.step === 'complete') {
            eventSource.close()
            const url = (data as { step: 'complete'; mediaUrl: string }).mediaUrl
            setState('adding-track')
            onTrackReady(url, selectedCardId)
              .then(() => setState('complete'))
              .catch((err) => {
                setError(err instanceof Error ? err.message : 'Failed to add track')
                setState('error')
              })
          } else if (data.step === 'error') {
            eventSource.close()
            setError((data as { step: 'error'; message: string }).message)
            setState('error')
          } else {
            setProgress(data)
          }
        } catch {
          // ignore parse errors
        }
      })

      eventSource.addEventListener('error', () => {
        eventSource.close()
        setError('Connection lost')
        setState('error')
      })
    },
    [onTrackReady],
  )

  const selectCard = useCallback(
    async (selectedCardId: string) => {
      if (!isAuthenticated) {
        loginWithRedirect()
        return
      }

      setCardId(selectedCardId)
      setState('uploading')

      try {
        const token = await getAccessTokenSilently()
        const { jobId: jid, eventSource } = await startJob(
          { youtubeUrl: youtubeUrl!, cardId: selectedCardId, yotoToken: token },
          token,
        )

        setJobId(jid)
        streamRef.current = eventSource
        listenToStream(eventSource, selectedCardId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start job')
        setState('error')
      }
    },
    [isAuthenticated, loginWithRedirect, getAccessTokenSilently, youtubeUrl, listenToStream],
  )

  const cancel = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
    if (jobId) {
      try {
        const token = await getAccessTokenSilently()
        await cancelJob(jobId, token)
      } catch {
        // best-effort cancel
      }
    }
    setState('idle')
    setYoutubeUrl(null)
    setCardId(null)
    setJobId(null)
    setProgress(null)
    setError(null)
  }, [jobId, getAccessTokenSilently])

  const reset = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
    setState('idle')
    setYoutubeUrl(null)
    setCardId(null)
    setJobId(null)
    setProgress(null)
    setError(null)
  }, [])

  return {
    state,
    youtubeUrl,
    cardId,
    progress,
    error,
    submitUrl,
    selectCard,
    cancel,
    reset,
  }
}
