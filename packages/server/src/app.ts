import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { Hono } from 'hono'
import { jobRoutes } from './routes/jobs'
import { iconRoutes } from './routes/icons'
import { serveStatic } from './static'

// AIDEV-NOTE: Read version from root package.json — bump on each release
import { readFileSync } from 'node:fs'
const VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf-8'))
    return pkg.version ?? 'dev'
  } catch {
    return 'dev'
  }
})()

// AIDEV-NOTE: In production Docker image, web dist is copied to packages/web/dist
// relative to the server's working directory. Resolve from cwd so it works in both
// development (pnpm build from root) and Docker contexts.
const WEB_DIST_PATH = resolve(process.cwd(), 'packages/web/dist')

export function createApp() {
  const app = new Hono()

  app.get('/api/health', (c) => c.json({ status: 'ok', version: VERSION }))

  // Job routes handle POST/DELETE/GET /api/jobs
  app.route('', jobRoutes)

  // Icon suggestion route: GET /api/suggest-icon
  app.route('', iconRoutes)

  // AIDEV-NOTE: Static serving only when built web assets exist (production or after build)
  if (process.env['NODE_ENV'] === 'production' || existsSync(WEB_DIST_PATH)) {
    app.use('*', serveStatic(WEB_DIST_PATH))
  }

  return app
}
