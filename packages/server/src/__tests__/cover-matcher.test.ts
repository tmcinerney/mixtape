import { describe, expect, it, vi, beforeEach } from 'vitest'

// AIDEV-NOTE: Mock getExtractor to avoid loading the 90MB embedding model in tests.
// The extractor is called as ext(texts, options) and returns { tolist: () => number[][] }.
vi.mock('../icon-matcher', () => {
  const makeVector = (seed: number, dims = 8): number[] => {
    const v = Array.from({ length: dims }, (_, i) => Math.sin(seed + i))
    const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    return v.map((x) => x / mag)
  }

  const fakeExtractor = vi.fn(async (texts: string[]) => ({
    tolist: () => texts.map((_, i) => makeVector(i)),
  }))

  return {
    getExtractor: vi.fn(async () => fakeExtractor),
    cosineSim: (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i]!, 0),
  }
})

import { matchCovers } from '../cover-matcher'

const CDN_URL_PATTERN = /^https:\/\/cdn\.yoto\.io\/myo-cover\/[\w-]+_[\w]+\.gif$/

beforeEach(() => {
  vi.clearAllMocks()
})

describe('matchCovers', () => {
  it('returns an array of CDN URLs matching the expected pattern', async () => {
    const results = await matchCovers('dinosaurs', 3)
    expect(results.length).toBeGreaterThan(0)
    for (const url of results) {
      expect(url).toMatch(CDN_URL_PATTERN)
    }
  })

  it('respects topK parameter', async () => {
    const results = await matchCovers('space adventure', 4)
    expect(results).toHaveLength(4)
  })

  it('defaults to topK=5', async () => {
    const results = await matchCovers('jungle animals')
    expect(results).toHaveLength(5)
  })

  it('returns exactly 1 result for an empty title (random fallback)', async () => {
    const results = await matchCovers('')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatch(CDN_URL_PATTERN)
  })

  it('returns exactly 1 result for a whitespace-only title', async () => {
    const results = await matchCovers('   ')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatch(CDN_URL_PATTERN)
  })
})
