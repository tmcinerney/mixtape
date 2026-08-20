import { Hono } from 'hono'
import { embedIcons, matchIcon, isReady } from '../icon-matcher'

// AIDEV-NOTE: Yoto API base for fetching icons server-side.
// We fetch directly rather than using the SDK (which is browser-only).
const YOTO_API_BASE = 'https://api.yotoplay.com'

const app = new Hono()

// AIDEV-NOTE: Embedding the whole icon corpus takes tens of seconds on this hardware,
// and the cache is in-memory so every container restart pays it again. Blocking the
// user's first suggest-icon request on it is what made auto-match feel broken.
// warmIconCorpus() lets the upload job start this in the background: a job runs for
// minutes before the user reaches the icon picker, so it is ready by the time they get
// there. Shared promise so concurrent jobs cannot start it twice.
let warmInFlight: Promise<void> | null = null

export async function warmIconCorpus(token: string): Promise<void> {
  if (isReady()) return
  if (warmInFlight) return warmInFlight

  warmInFlight = (async () => {
    const res = await fetch(`${YOTO_API_BASE}/media/displayIcons/user/yoto`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(`Failed to fetch icons: ${res.status}`)
    const data = (await res.json()) as {
      displayIcons: Array<{
        mediaId: string
        title?: string
        publicTags?: string[]
        url?: string
      }>
    }
    await embedIcons(data.displayIcons)
  })().finally(() => {
    warmInFlight = null
  })

  return warmInFlight
}

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

  // Lazy init on first request, or join a warm-up already running from a job start.
  if (!isReady()) {
    const token = c.req.header('Authorization')?.replace('Bearer ', '')
    if (!token) {
      return c.json({ error: 'Authorization required for first icon load' }, 401)
    }

    try {
      await warmIconCorpus(token)
    } catch (err) {
      return c.json({ error: `Failed to initialize icon matcher: ${err}` }, 500)
    }
  }

  const matches = await matchIcon(title, 5)
  return c.json({ title, matches })
})

export { app as iconRoutes }
