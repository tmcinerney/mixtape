import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Hono } from 'hono'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { serveStatic } from '../static'

const testDistDir = join(tmpdir(), `mixtape-static-test-${Date.now()}`)

beforeAll(() => {
  mkdirSync(testDistDir, { recursive: true })
  mkdirSync(join(testDistDir, 'assets'), { recursive: true })
  writeFileSync(join(testDistDir, 'index.html'), '<html><body>SPA</body></html>')
  writeFileSync(join(testDistDir, 'assets', 'app.js'), 'console.log("hello")')
  writeFileSync(join(testDistDir, 'assets', 'style.css'), 'body { margin: 0 }')
})

afterAll(() => {
  rmSync(testDistDir, { recursive: true, force: true })
})

function createTestApp() {
  const app = new Hono()

  // API route registered before static middleware (mirrors real app)
  app.get('/api/health', (c) => c.json({ status: 'ok' }))
  app.use('*', serveStatic(testDistDir))

  return app
}

describe('serveStatic middleware', () => {
  const app = createTestApp()

  it('serves static files from dist directory', async () => {
    const res = await app.request('/assets/app.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/javascript')
    const text = await res.text()
    expect(text).toBe('console.log("hello")')
  })

  it('serves CSS files with correct content-type', async () => {
    const res = await app.request('/assets/style.css')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/css')
  })

  it('returns index.html for SPA fallback on unknown routes', async () => {
    const res = await app.request('/some/app/route')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html')
    const text = await res.text()
    expect(text).toContain('SPA')
  })

  it('passes through API routes without interference', async () => {
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })

  it('serves index.html at root path', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html')
  })
})
