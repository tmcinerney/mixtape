import { Hono } from 'hono'
import { embedIcons, matchIcon, isReady } from '../icon-matcher'

// AIDEV-NOTE: Yoto API base for fetching icons server-side.
// We fetch directly rather than using the SDK (which is browser-only).
const YOTO_API_BASE = 'https://api.yotoplay.com'

const app = new Hono()

/**
 * GET /api/suggest-icon?title=...
 *
 * Returns the best matching Yoto display icon for a track title
 * using semantic similarity (local embeddings, no external API cost).
 *
 * Requires a Yoto Bearer token in the Authorization header to fetch
 * the icon list on first call (cached in memory afterwards).
 */
app.get('/api/suggest-icon', async (c) => {
  const title = c.req.query('title')
  if (!title) {
    return c.json({ error: 'Missing title parameter' }, 400)
  }

  // Ensure icons are embedded (lazy init on first request)
  if (!isReady()) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Authorization required for first icon load' }, 401)
    }

    try {
      const res = await fetch(`${YOTO_API_BASE}/user/icons/displayIcon`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        return c.json({ error: `Failed to fetch icons: ${res.status}` }, 502)
      }

      const data = (await res.json()) as {
        displayIcons: Array<{
          mediaId: string
          title?: string
          publicTags?: string[]
          url?: string
        }>
      }
      await embedIcons(data.displayIcons)
    } catch (err) {
      return c.json({ error: `Failed to initialize icon matcher: ${err}` }, 500)
    }
  }

  const matches = await matchIcon(title, 5)
  return c.json({ title, matches })
})

export { app as iconRoutes }
