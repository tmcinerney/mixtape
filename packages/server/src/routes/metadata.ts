import { Hono } from 'hono'
import { classifyUrl } from '@mixtape/shared'
import { extractMetadata } from '../youtube-metadata'
import { matchCovers } from '../cover-matcher'

const app = new Hono()

// AIDEV-NOTE: Auth header required on all metadata requests — token passed through to yt-dlp calls downstream.
app.get('/api/metadata', async (c) => {
  const auth = c.req.header('Authorization')
  if (!auth) return c.json({ error: 'Authorization required' }, 401)

  const url = c.req.query('url')
  if (!url) return c.json({ error: 'url parameter is required' }, 400)

  try {
    new URL(url)
  } catch {
    return c.json({ error: 'Invalid URL' }, 400)
  }

  const classification = classifyUrl(url)

  if (classification.type === 'rejected') {
    return c.json({ error: classification.reason }, 400)
  }

  if (classification.type === 'ambiguous') {
    return c.json({
      type: 'ambiguous',
      videoId: classification.videoId,
      listId: classification.listId,
    })
  }

  try {
    const metadata = await extractMetadata(url, classification.type)
    const coverOptions = await matchCovers(metadata.suggestedTitle, 5)
    return c.json({ ...metadata, coverOptions })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to extract metadata'
    return c.json({ error: message }, 500)
  }
})

export { app as metadataRoutes }
