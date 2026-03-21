import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { streamSSE } from 'hono/streaming'
import { JobRequestSchema } from '@mixtape/shared'
import type { JobProgress } from '@mixtape/shared'
import { JobQueue } from '../job-queue'
import { runJob } from '../job-runner'

// AIDEV-NOTE: Single shared queue instance for the server process.
// Max 3 concurrent jobs, cleanup after 5 minutes.
const queue = new JobQueue({
  maxConcurrent: 3,
  cleanupDelayMs: 5 * 60 * 1000,
})

const app = new Hono()

app.post('/api/jobs', zValidator('json', JobRequestSchema), (c) => {
  const body = c.req.valid('json')

  return streamSSE(c, async (stream) => {
    const jobId = queue.enqueue(body)

    // Send initial event with job ID
    await stream.writeSSE({ data: JSON.stringify({ jobId }), event: 'init' })

    // Wait for the job to be promoted to running
    const entry = queue.getEntry(jobId)
    if (!entry) {
      await stream.writeSSE({
        data: JSON.stringify({ step: 'error', message: 'Job not found', code: 'QUEUE_ERROR' }),
        event: 'progress',
      })
      return
    }

    const onEvent = async (event: JobProgress) => {
      await stream.writeSSE({ data: JSON.stringify(event), event: 'progress' })
    }

    try {
      await runJob(
        {
          youtubeUrl: body.youtubeUrl,
          cardId: body.cardId,
          yotoToken: body.yotoToken,
        },
        onEvent,
        entry.abortController.signal,
      )
      queue.markComplete(jobId)
    } catch {
      queue.markFailed(jobId)
    }
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
    youtubeUrl: j.request.youtubeUrl,
    cardId: j.request.cardId,
    createdAt: j.createdAt,
  }))
  return c.json({ jobs })
})

export { app as jobRoutes }
