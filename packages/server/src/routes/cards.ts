import { Hono } from 'hono'
import { createCard } from '../yoto-cards'

const app = new Hono()

// AIDEV-NOTE: Thin proxy to server-side createCard — single source of truth
// for card creation payload shape. Avoids duplicating Yoto API knowledge in the client.
app.post('/api/cards', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Authorization required' }, 401)

  const body = (await c.req.json()) as { title?: string; coverUrl?: string }
  if (!body.title?.trim()) return c.json({ error: 'Title is required' }, 400)

  try {
    const cardId = await createCard(body.title.trim(), body.coverUrl, token)
    return c.json({ cardId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create card'
    return c.json({ error: message }, 500)
  }
})

app.delete('/api/cards/:id', async (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Authorization required' }, 401)

  const cardId = c.req.param('id')
  try {
    const resp = await fetch(`https://api.yotoplay.com/content/${cardId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) throw new Error(`Yoto API returned ${resp.status}`)
    return c.json({ deleted: true, cardId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete card'
    return c.json({ error: message }, 500)
  }
})

export { app as cardRoutes }
