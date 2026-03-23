import { useCallback, useRef, useState } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import type { MetadataResponse } from '@mixtape/shared'
import { classifyUrl } from '@mixtape/shared'
import { fetchMetadata, startImport, cancelJob } from '../api/client'

// AIDEV-NOTE: 8-state machine for the unified import flow. Handles both
// single-video and playlist imports, including ambiguous URL disambiguation.
export type FlowState =
  | 'idle'
  | 'disambiguating'
  | 'extracting'
  | 'confirming'
  | 'importing'
  | 'complete'
  | 'cancelled'
  | 'error'

interface CompletedTrack {
  index: number
  title: string
  status: 'done' | 'skipped'
  reason?: string
}

interface ImportFlowResult {
  state: FlowState
  metadata: MetadataResponse | null
  ambiguousUrl: { videoId: string; listId: string } | null
  progress: {
    currentTrack: number
    totalTracks: number
    currentTitle: string
    trackProgress: { step: string; progress: number } | null
  } | null
  completedTracks: CompletedTrack[]
  result: {
    cardId: string
    imported: number
    skipped: Array<{ title: string; reason: string }>
  } | null
  error: string | null
  submitUrl: (url: string) => void
  disambiguate: (choice: 'video' | 'playlist') => void
  confirmImport: (params: {
    cardId?: string
    cardTitle?: string
    coverUrl?: string
    tracks: Array<{ videoId: string; title: string }>
  }) => void
  cancel: () => void
  reset: () => void
}

export function useImportFlow(): ImportFlowResult {
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0()

  const [state, setState] = useState<FlowState>('idle')
  const [metadata, setMetadata] = useState<MetadataResponse | null>(null)
  const [ambiguousUrl, setAmbiguousUrl] = useState<{ videoId: string; listId: string } | null>(null)
  const [progress, setProgress] = useState<ImportFlowResult['progress']>(null)
  const [completedTracks, setCompletedTracks] = useState<CompletedTrack[]>([])
  const [result, setResult] = useState<ImportFlowResult['result']>(null)
  const [error, setError] = useState<string | null>(null)

  // AIDEV-NOTE: streamRef and jobIdRef track the active SSE connection so we
  // can close it and cancel the job on user-initiated cancellation.
  const streamRef = useRef<{ close: () => void } | null>(null)
  const jobIdRef = useRef<string | null>(null)
  // Tracks cardId created server-side before the complete event arrives
  const pendingCardIdRef = useRef<string | null>(null)

  // AIDEV-NOTE: Core metadata fetch logic extracted here so both submitUrl
  // and disambiguate can share the same extracting → confirming/idle path.
  const doFetchMetadata = useCallback(
    async (url: string) => {
      setState('extracting')
      try {
        const token = await getAccessTokenSilently()
        const data = await fetchMetadata(url, token)
        // fetchMetadata may return ambiguous shape from client but that's already
        // handled upstream via classifyUrl; here we always expect MetadataResponse.
        setMetadata(data as MetadataResponse)
        setState('confirming')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch metadata')
        setState('idle')
      }
    },
    [getAccessTokenSilently],
  )

  const submitUrl = useCallback(
    (url: string) => {
      if (!isAuthenticated) {
        // AIDEV-NOTE: Caller must re-paste URL after login redirect — future
        // enhancement could preserve via sessionStorage.
        loginWithRedirect()
        return
      }

      setError(null)

      const classification = classifyUrl(url)

      if (classification.type === 'rejected') {
        setError(classification.reason)
        return
      }

      if (classification.type === 'ambiguous') {
        setAmbiguousUrl({ videoId: classification.videoId, listId: classification.listId })
        setState('disambiguating')
        return
      }

      // video or playlist — proceed straight to extracting
      void doFetchMetadata(url)
    },
    [isAuthenticated, loginWithRedirect, doFetchMetadata],
  )

  const disambiguate = useCallback(
    (choice: 'video' | 'playlist') => {
      if (!ambiguousUrl) return

      const url =
        choice === 'video'
          ? `https://www.youtube.com/watch?v=${ambiguousUrl.videoId}`
          : `https://www.youtube.com/playlist?list=${ambiguousUrl.listId}`

      void doFetchMetadata(url)
    },
    [ambiguousUrl, doFetchMetadata],
  )

  // AIDEV-NOTE: Listens to the SSE event stream from startImport and maps each
  // event type to state/progress updates. Uses named event types (not 'progress'
  // like startJob) because the import stream uses typed SSE events.
  // AIDEV-NOTE: Server sends all SSE events with `event: 'progress'` and the
  // discriminated type field is inside the JSON data. We listen for 'progress'
  // and switch on `data.type`, matching the ImportProgressSchema union.
  const listenToImportStream = useCallback((eventSource: EventTarget & { close: () => void }) => {
    eventSource.addEventListener('progress', (event: Event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data as string) as Record<string, unknown>
        const type = data.type as string

        switch (type) {
          case 'card-created':
            pendingCardIdRef.current = data.cardId as string
            break

          case 'track-start':
            setProgress({
              currentTrack: data.index as number,
              totalTracks: data.total as number,
              currentTitle: data.title as string,
              trackProgress: null,
            })
            break

          case 'track-progress':
            setProgress((prev) =>
              prev
                ? {
                    ...prev,
                    trackProgress: {
                      step: data.step as string,
                      progress: data.progress as number,
                    },
                  }
                : prev,
            )
            break

          case 'track-complete':
            setCompletedTracks((prev) => [
              ...prev,
              {
                index: data.index as number,
                title: (data.title as string | undefined) ?? '',
                status: 'done',
              },
            ])
            break

          case 'track-skipped':
            setCompletedTracks((prev) => [
              ...prev,
              {
                index: data.index as number,
                title: data.title as string,
                status: 'skipped',
                reason: data.reason as string,
              },
            ])
            break

          case 'complete': {
            eventSource.close()
            const cardId = (data.cardId as string | undefined) ?? pendingCardIdRef.current ?? ''
            setResult({
              cardId,
              imported: data.imported as number,
              skipped: (data.skipped as Array<{ title: string; reason: string }>) ?? [],
            })
            setState('complete')
            break
          }

          case 'cancelled': {
            eventSource.close()
            const cardId = (data.cardId as string | undefined) ?? pendingCardIdRef.current ?? ''
            setResult({
              cardId,
              imported: data.imported as number,
              skipped: [],
            })
            setState('cancelled')
            break
          }

          case 'error':
            eventSource.close()
            setError((data.message as string | undefined) ?? 'Import failed')
            setState('error')
            break
        }
      } catch {
        // ignore parse errors on individual events
      }
    })

    // AIDEV-NOTE: The generic 'error' EventTarget event fires when the SSE
    // connection drops unexpectedly (not the same as the named 'error' SSE
    // event above which carries a message payload).
    eventSource.addEventListener('error', (e: Event) => {
      if (!(e instanceof MessageEvent)) {
        setError((prev) => prev ?? 'Connection lost')
        setState('error')
      }
    })
  }, [])

  const confirmImport = useCallback(
    (params: {
      cardId?: string
      cardTitle?: string
      coverUrl?: string
      tracks: Array<{ videoId: string; title: string }>
    }) => {
      setState('importing')
      setCompletedTracks([])
      pendingCardIdRef.current = null

      void (async () => {
        try {
          const token = await getAccessTokenSilently()
          const { jobId, eventSource } = await startImport(
            {
              // AIDEV-NOTE: url is required by ImportJobRequest schema but only used
              // server-side for logging; we pass a placeholder when not available.
              url: 'https://www.youtube.com/',
              ...params,
              yotoToken: token,
            },
            token,
          )

          jobIdRef.current = jobId
          streamRef.current = eventSource
          listenToImportStream(eventSource)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to start import')
          setState('error')
        }
      })()
    },
    [getAccessTokenSilently, listenToImportStream],
  )

  const cancel = useCallback(async () => {
    // Close the SSE stream immediately
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }

    // Best-effort server cancellation
    if (jobIdRef.current) {
      try {
        const token = await getAccessTokenSilently()
        await cancelJob(jobIdRef.current, token)
      } catch {
        // best-effort — don't block the UI transition
      }
      jobIdRef.current = null
    }

    // AIDEV-NOTE: Cancel during importing goes to 'cancelled' (not 'idle') so
    // the UI can display partial import results before the user resets.
    setState('cancelled')
  }, [getAccessTokenSilently])

  const reset = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
    jobIdRef.current = null
    pendingCardIdRef.current = null

    setState('idle')
    setMetadata(null)
    setAmbiguousUrl(null)
    setProgress(null)
    setCompletedTracks([])
    setResult(null)
    setError(null)
  }, [])

  return {
    state,
    metadata,
    ambiguousUrl,
    progress,
    completedTracks,
    result,
    error,
    submitUrl,
    disambiguate,
    confirmImport,
    cancel,
    reset,
  }
}
