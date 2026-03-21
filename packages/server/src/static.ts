import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import type { MiddlewareHandler } from 'hono'

// AIDEV-NOTE: Content-type map covers common Vite output file types
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain',
}

/**
 * Hono middleware that serves static files from the Vite build output directory
 * and provides SPA fallback (serving index.html for non-API, non-static routes).
 */
export function serveStatic(distPath: string): MiddlewareHandler {
  const absoluteDistPath = resolve(distPath)

  return async (c, next) => {
    // AIDEV-NOTE: Let API routes pass through — they're handled by app routes
    if (c.req.path.startsWith('/api')) {
      return next()
    }

    // Try to serve the exact file requested
    const filePath = join(absoluteDistPath, c.req.path)

    // Prevent directory traversal
    if (!filePath.startsWith(absoluteDistPath)) {
      return next()
    }

    if (existsSync(filePath) && statSync(filePath).isFile()) {
      const ext = extname(filePath)
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
      const data = new Uint8Array(readFileSync(filePath))
      return c.body(data, 200, { 'Content-Type': contentType })
    }

    // SPA fallback: serve index.html for any non-file route
    const indexPath = join(absoluteDistPath, 'index.html')
    if (existsSync(indexPath)) {
      const data = new Uint8Array(readFileSync(indexPath))
      return c.body(data, 200, { 'Content-Type': 'text/html' })
    }

    return next()
  }
}
