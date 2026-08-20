import { describe, expect, it, vi, afterEach } from 'vitest'
import { startJob } from '../api/client'

function sseStream(chunks: string[], { closeAfter = true } = {}) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      if (closeAfter) controller.close()
    },
  })
}

function mockPost(body: ReadableStream<Uint8Array>) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    body,
  } as unknown as Response)
}

const params = {
  youtubeUrl: 'https://www.youtube.com/watch?v=abc',
  cardId: 'card-1',
  yotoToken: 'token',
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('startJob', () => {
  it('resolves the job id from the init event', async () => {
    mockPost(sseStream(['event: init\ndata: {"jobId":"job-1"}\n\n'], { closeAfter: false }))

    const { jobId } = await startJob(params, 'token')
    expect(jobId).toBe('job-1')
  })

  // AIDEV-NOTE: Regression test for a frozen UI. The SSE pump used to `return` silently
  // when the stream ended, and only its `.catch` dispatched an error — but a clean close
  // does not throw. So a proxy dropping the connection mid-job (Traefik's default 180s
  // idle timeout) left the browser parked on the last percentage with no error, no
  // timeout, and nothing in the logs.
  it('raises an error when the stream closes before a terminal event', async () => {
    mockPost(
      sseStream([
        'event: init\ndata: {"jobId":"job-1"}\n\n',
        'event: progress\ndata: {"step":"transcode","progress":95}\n\n',
      ]),
    )

    const { eventSource } = await startJob(params, 'token')

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no error event was raised')), 1000)
      eventSource.addEventListener('error', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  })

  it('stays quiet when the consumer closed the stream itself', async () => {
    mockPost(sseStream(['event: init\ndata: {"jobId":"job-1"}\n\n'], { closeAfter: false }))

    const { eventSource } = await startJob(params, 'token')
    const onError = vi.fn()
    eventSource.addEventListener('error', onError)

    // A terminal event makes the consumer close the stream; that is not a failure.
    eventSource.close()
    await new Promise((r) => setTimeout(r, 50))

    expect(onError).not.toHaveBeenCalled()
  })
})
