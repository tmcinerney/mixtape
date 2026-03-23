import { Hono } from 'hono'
import { matchCovers } from '../cover-matcher'

const app = new Hono()

// AIDEV-NOTE: Auth header required — consistent with other API routes.
app.get('/api/cover/match', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: 'Authorization required' }, 401)

  const title = c.req.query('title') ?? ''
  const covers = await matchCovers(title, 5)
  return c.json({ covers })
})

export { app as coverRoutes }
