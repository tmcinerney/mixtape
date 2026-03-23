import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { ImportJobRequestSchema } from '@mixtape/shared'
import type { ImportProgress } from '@mixtape/shared'
import { JobQueue } from '../job-queue'
import { runImport } from '../import-runner'

// AIDEV-NOTE: Single shared queue instance for the server process.
// Max 3 concurrent jobs, cleanup after 5 minutes.
const queue = new JobQueue({
  maxConcurrent: 3,
  cleanupDelayMs: 5 * 60 * 1000,
})

const app = new Hono()

// AIDEV-NOTE: Token expiry check uses simple base64 decode of JWT payload — no crypto needed.
// If remaining token lifetime < trackCount * 30s we warn but still proceed.
function getTokenExpiry(authHeader: string | undefined): number | null {
  if (!authHeader) return null
  const token = authHeader.replace('Bearer ', '')
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(atob(parts[1]!)) as { exp?: number }
    return payload.exp ?? null
  } catch {
    return null
  }
}

app.post('/api/jobs/import', zValidator('json', ImportJobRequestSchema), (c) => {
  const body = c.req.valid('json')

  return streamSSE(c, async (stream) => {
    // AIDEV-NOTE: Warn if JWT will expire before estimated import completes (~30s per track).
    const exp = getTokenExpiry(c.req.header('Authorization'))
    const nowSecs = Math.floor(Date.now() / 1000)
    if (exp !== null && exp - nowSecs < body.tracks.length * 30) {
      await stream.writeSSE({
        data: JSON.stringify({ warning: 'Token may expire before import completes' }),
        event: 'warning',
      })
    }

    const jobId = queue.enqueue(body)

    // Send initial event with job ID
    await stream.writeSSE({ data: JSON.stringify({ jobId }), event: 'init' })

    const entry = queue.getEntry(jobId)
    if (!entry) {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'error', message: 'Job not found' }),
        event: 'progress',
      })
      return
    }

    const onEvent = async (event: ImportProgress) => {
      await stream.writeSSE({ data: JSON.stringify(event), event: 'progress' })
    }

    try {
      await runImport(
        {
          url: body.url,
          cardId: body.cardId,
          cardTitle: body.cardTitle,
          coverUrl: body.coverUrl,
          tracks: body.tracks,
          yotoToken: body.yotoToken,
        },
        onEvent,
        entry.abortController.signal,
      )
      queue.markComplete(jobId)
    } catch {
      queue.markFailed(jobId)
    }

    // AIDEV-NOTE: Write a final sentinel event to ensure Hono flushes the
    // last real event before closing the stream. Without this, the 'complete'
    // event can be buffered and lost when the response ends.
    await stream.writeSSE({ data: '', event: 'done' })
  })
})

app.delete('/api/jobs/:id', (c) => {
  const id = c.req.param('id')
  const cancelled = queue.cancel(id)
  if (!cancelled) {
    return c.json({ error: 'Job not found or already finished' }, 404)
  }
  return c.json({ cancelled: true, id })
})

app.get('/api/jobs', (c) => {
  const jobs = queue.listJobs().map((j) => ({
    id: j.id,
    status: j.status,
    url: j.request.url,
    cardId: j.request.cardId,
    createdAt: j.createdAt,
  }))
  return c.json({ jobs })
})

export { app as jobRoutes }
