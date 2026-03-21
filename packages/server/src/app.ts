import { Hono } from 'hono'
import { jobRoutes } from './routes/jobs'

// AIDEV-NOTE: version placeholder until we wire up package.json reading
const VERSION = '0.1.0'

export function createApp() {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok', version: VERSION }))

  // Job routes handle POST/DELETE/GET /api/jobs
  app.route('', jobRoutes)

  return app
}
