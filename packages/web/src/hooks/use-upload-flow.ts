import { useCallback, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import type { JobProgress } from '@mixtape/shared'
import { startJob, cancelJob } from '../api/client'

type FlowState = 'idle' | 'selecting-card' | 'uploading' | 'adding-track' | 'complete' | 'error'

interface UploadFlowResult {
  state: FlowState
  youtubeUrl: string | null
  cardId: string | null
  jobId: string | null
  progress: JobProgress | null
  mediaUrl: string | null
  error: string | null
  submitUrl: (url: string) => void
  selectCard: (cardId: string) => void
  cancel: () => void
  reset: () => void
  // AIDEV-NOTE: called by landing page after use-add-track completes
  markComplete: () => void
  markAddingTrack: (mediaUrl: string) => void
}

export function useUploadFlow(): UploadFlowResult {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0()

  const [state, setState] = useState<FlowState>('idle')
  const [youtubeUrl, setYoutubeUrl] = useState<string | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<JobProgress | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  const submitUrl = useCallback((url: string) => {
    setYoutubeUrl(url)
    setState('selecting-card')
    setError(null)
  }, [])

  const selectCard = useCallback(
    async (selectedCardId: string) => {
      if (!isAuthenticated) {
        loginWithRedirect()
        return
      }

      setCardId(selectedCardId)

      try {
        const token = await getAccessTokenSilently()

        const { jobId: jid, eventSource } = await startJob(
          { youtubeUrl: youtubeUrl!, cardId: selectedCardId, yotoToken: token },
          token,
        )

        setJobId(jid)
        eventSourceRef.current = eventSource
        setState('uploading')

        // AIDEV-NOTE: SSE event listeners for job progress
        eventSource.addEventListener('progress', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data as string) as JobProgress
            if (data.step === 'complete') {
              eventSource.close()
              setMediaUrl((data as { step: 'complete'; mediaUrl: string }).mediaUrl)
              setState('adding-track')
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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start job')
        setState('error')
      }
    },
    [isAuthenticated, loginWithRedirect, getAccessTokenSilently, youtubeUrl],
  )

  const cancel = useCallback(async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
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
    setMediaUrl(null)
    setError(null)
  }, [jobId, getAccessTokenSilently])

  const reset = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setState('idle')
    setYoutubeUrl(null)
    setCardId(null)
    setJobId(null)
    setProgress(null)
    setMediaUrl(null)
    setError(null)
  }, [])

  const markAddingTrack = useCallback((url: string) => {
    setMediaUrl(url)
    setState('adding-track')
  }, [])

  const markComplete = useCallback(() => {
    setState('complete')
  }, [])

  return {
    state,
    youtubeUrl,
    cardId,
    jobId,
    progress,
    mediaUrl,
    error,
    submitUrl,
    selectCard,
    cancel,
    reset,
    markComplete,
    markAddingTrack,
  }
}
