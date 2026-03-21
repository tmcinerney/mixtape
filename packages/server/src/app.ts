import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { JobRequestSchema } from '@mixtape/shared'

// AIDEV-NOTE: version placeholder until we wire up package.json reading
const VERSION = '0.1.0'

export function createApp() {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok', version: VERSION }))

  app.post('/api/jobs', zValidator('json', JobRequestSchema), (c) => {
    // AIDEV-TODO: wire to job queue in Phase 5
    const jobId = crypto.randomUUID()
    return c.json({ jobId }, 201)
  })

  app.delete('/api/jobs/:id', (c) => {
    // AIDEV-TODO: wire to job queue cancellation in Phase 5
    return c.json({ cancelled: true, id: c.req.param('id') })
  })

  app.get('/api/jobs', (c) => {
    // AIDEV-TODO: wire to job queue listing in Phase 5
    return c.json({ jobs: [] })
  })

  return app
}
