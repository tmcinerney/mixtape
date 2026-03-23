import type { JobRequest, MetadataResponse, ImportJobRequest } from '@mixtape/shared'

// AIDEV-NOTE: MetadataResult covers both typed responses (video/playlist) and the
// ambiguous case where the URL points to both a video and a playlist simultaneously.
export type MetadataResult =
  | (MetadataResponse & { type: 'video' | 'playlist' })
  | { type: 'ambiguous'; videoId: string; listId: string }

const API_BASE = '/api'

// AIDEV-NOTE: Parses SSE lines from a fetch ReadableStream. The server returns
// the SSE stream directly on the POST response (not a separate EventSource URL).
// We emit events on an EventTarget so the consumer can use addEventListener().
function parseSSEStream(
  reader: ReadableStream<Uint8Array>,
  target: EventTarget,
  signal?: AbortSignal,
) {
  const decoder = new TextDecoder()
  const streamReader = reader.getReader()
  let buffer = ''
  let currentEvent = ''
  let currentData = ''

  async function pump(): Promise<void> {
    while (true) {
      if (signal?.aborted) {
        streamReader.cancel()
        return
      }

      const { done, value } = await streamReader.read()
      if (done) return

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          currentData = line.slice(6)
        } else if (line === '') {
          if (currentData) {
            const event = new MessageEvent(currentEvent || 'message', { data: currentData })
            target.dispatchEvent(event)
          }
          currentEvent = ''
          currentData = ''
        }
      }
    }
  }

  pump().catch(() => {
    target.dispatchEvent(new Event('error'))
  })
}

interface JobStream extends EventTarget {
  close: () => void
}

export async function startJob(
  params: JobRequest,
  _token: string,
): Promise<{ jobId: string; eventSource: JobStream }> {
  const controller = new AbortController()

  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: controller.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to start job: ${res.status} ${text}`)
  }

  if (!res.body) {
    throw new Error('No response body for SSE stream')
  }

  // AIDEV-NOTE: We parse the SSE stream to extract the jobId from the init
  // event, then continue forwarding progress events to the consumer.
  const target = new EventTarget()
  const stream: JobStream = Object.assign(target, {
    close: () => controller.abort(),
  })

  // Start parsing in background
  parseSSEStream(res.body, target, controller.signal)

  // Wait for the init event to get the jobId
  const jobId = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for job init')), 10000)

    target.addEventListener(
      'init',
      (e) => {
        clearTimeout(timeout)
        try {
          const data = JSON.parse((e as MessageEvent).data as string) as { jobId: string }
          resolve(data.jobId)
        } catch {
          reject(new Error('Failed to parse init event'))
        }
      },
      { once: true },
    )

    target.addEventListener(
      'error',
      () => {
        clearTimeout(timeout)
        reject(new Error('Stream error before init'))
      },
      { once: true },
    )
  })

  return { jobId, eventSource: stream }
}

export async function cancelJob(jobId: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) {
    throw new Error(`Failed to cancel job: ${res.status} ${res.statusText}`)
  }
}

export interface SuggestedIcon {
  mediaId: string
  ref: string
  title: string
  url: string
  score: number
}

export async function fetchMetadata(url: string, token: string): Promise<MetadataResult> {
  const res = await fetch(`${API_BASE}/metadata?url=${encodeURIComponent(url)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(body.error ?? `Failed to fetch metadata: ${res.status}`)
  }
  return res.json()
}

export async function startImport(
  params: ImportJobRequest,
  token: string,
): Promise<{ jobId: string; eventSource: JobStream }> {
  const controller = new AbortController()

  const res = await fetch(`${API_BASE}/jobs/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
    signal: controller.signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to start import: ${res.status} ${text}`)
  }

  if (!res.body) {
    throw new Error('No response body for SSE stream')
  }

  // AIDEV-NOTE: Same SSE pattern as startJob — parse the stream into an EventTarget
  // so callers can listen for progress events via addEventListener().
  const target = new EventTarget()
  const stream: JobStream = Object.assign(target, {
    close: () => controller.abort(),
  })

  parseSSEStream(res.body, target, controller.signal)

  const jobId = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for import init')), 10000)

    target.addEventListener(
      'init',
      (e) => {
        clearTimeout(timeout)
        try {
          const data = JSON.parse((e as MessageEvent).data as string) as { jobId: string }
          resolve(data.jobId)
        } catch {
          reject(new Error('Failed to parse init event'))
        }
      },
      { once: true },
    )

    target.addEventListener(
      'error',
      () => {
        clearTimeout(timeout)
        reject(new Error('Stream error before init'))
      },
      { once: true },
    )
  })

  return { jobId, eventSource: stream }
}

export async function matchCover(title: string, token: string): Promise<string[]> {
  const res = await fetch(`${API_BASE}/cover/match?title=${encodeURIComponent(title)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = (await res.json()) as { covers: string[] }
  return body.covers
}

export async function suggestIcon(title: string, token: string): Promise<SuggestedIcon | null> {
  const params = new URLSearchParams({ title })
  const res = await fetch(`${API_BASE}/suggest-icon?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!res.ok) return null

  const data = (await res.json()) as { matches: SuggestedIcon[] }
  return data.matches[0] ?? null
}
