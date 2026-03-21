import { useCallback, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import type { JobProgress } from '@mixtape/shared'
import { startJob, cancelJob } from '../api/client'

type FlowState =
  | 'idle'
  | 'selecting-card'
  | 'uploading'
  | 'confirming'
  | 'adding-track'
  | 'complete'
  | 'error'

interface TrackReadyParams {
  mediaUrl: string
  cardId: string
  title: string
  iconUrl?: string
}

interface UploadFlowOptions {
  // AIDEV-NOTE: called when user confirms the track details — the hook
  // transitions to adding-track, then complete/error based on the result.
  onTrackReady: (params: TrackReadyParams) => Promise<void>
}

/** Data available during the confirming state */
export interface ConfirmData {
  mediaUrl: string
  title: string
  suggestedTitle: string
}

interface UploadFlowResult {
  state: FlowState
  youtubeUrl: string | null
  cardId: string | null
  progress: JobProgress | null
  error: string | null
  /** Available when state === 'confirming' */
  confirmData: ConfirmData | null
  submitUrl: (url: string) => void
  selectCard: (cardId: string) => void
  /** User confirms the track title and optional icon */
  confirmTrack: (title: string, iconUrl?: string) => void
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
  const [confirmData, setConfirmData] = useState<ConfirmData | null>(null)

  const streamRef = useRef<{ close: () => void } | null>(null)

  const submitUrl = useCallback(
    (url: string) => {
      if (!isAuthenticated) {
        // AIDEV-NOTE: stash URL before redirecting so we could restore it after
        // login. For now the user re-pastes — a future enhancement could use
        // sessionStorage to preserve the URL across the redirect.
        loginWithRedirect()
        return
      }
      setYoutubeUrl(url)
      setState('selecting-card')
      setError(null)
    },
    [isAuthenticated, loginWithRedirect],
  )

  // AIDEV-NOTE: SSE event handling. On complete, transitions to 'confirming'
  // so the user can edit the title and pick an icon before adding the track.
  const listenToStream = useCallback((eventSource: EventTarget & { close: () => void }) => {
    eventSource.addEventListener('progress', (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data as string) as JobProgress
        if (data.step === 'complete') {
          eventSource.close()
          const { mediaUrl, title, suggestedTitle } = data as {
            step: 'complete'
            mediaUrl: string
            title: string
            suggestedTitle: string
          }
          setConfirmData({ mediaUrl, title, suggestedTitle })
          setState('confirming')
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
  }, [])

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
        listenToStream(eventSource)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start job')
        setState('error')
      }
    },
    [isAuthenticated, loginWithRedirect, getAccessTokenSilently, youtubeUrl, listenToStream],
  )

  // AIDEV-NOTE: Called from the confirm screen with the user's final title choice
  // and optional icon. Triggers onTrackReady which adds the track to the card.
  const confirmTrack = useCallback(
    (title: string, iconUrl?: string) => {
      if (!confirmData || !cardId) return

      setState('adding-track')
      onTrackReady({
        mediaUrl: confirmData.mediaUrl,
        cardId,
        title,
        ...(iconUrl !== undefined ? { iconUrl } : {}),
      })
        .then(() => setState('complete'))
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to add track')
          setState('error')
        })
    },
    [confirmData, cardId, onTrackReady],
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
    setConfirmData(null)
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
    setConfirmData(null)
  }, [])

  return {
    state,
    youtubeUrl,
    cardId,
    progress,
    error,
    confirmData,
    submitUrl,
    selectCard,
    confirmTrack,
    cancel,
    reset,
  }
}
