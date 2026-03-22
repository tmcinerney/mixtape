// AIDEV-NOTE: Dynamic import to handle CJS/ESM interop with @huggingface/transformers.
// The package exports pipeline on `default` when loaded via dynamic import in tsx.
async function loadPipeline() {
  const mod = await import('@huggingface/transformers')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolved = (mod as any).default ?? mod
  return resolved.pipeline as (...args: unknown[]) => Promise<unknown>
}

// AIDEV-NOTE: Semantic icon matching using local embeddings.
// Uses all-MiniLM-L6-v2 (~90MB) for text embeddings. The model is downloaded
// on first use and cached in ~/.cache/huggingface. In Docker, it's pre-downloaded
// during the build so there's no cold-start delay.
//
// Icon embeddings are computed once when the icon list is first provided,
// then cached in memory. Subsequent searches only embed the query.

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'

interface IconEntry {
  mediaId: string
  title: string
  tags: string[]
  url: string
  ref: string
}

export interface IconMatch {
  mediaId: string
  ref: string
  title: string
  url: string
  score: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let extractor: any = null
let cachedIcons: IconEntry[] = []
let cachedVectors: number[][] = []

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getExtractor(): Promise<any> {
  if (!extractor) {
    const pipelineFn = await loadPipeline()
    extractor = await pipelineFn('feature-extraction', MODEL_NAME, {
      dtype: 'fp32',
    })
  }
  return extractor
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
  }
  return dot // vectors are already normalized
}

/**
 * Embed the icon corpus. Call this once with the full icon list from the Yoto SDK.
 * Results are cached — subsequent calls with the same icon count are no-ops.
 */
export async function embedIcons(
  icons: Array<{ mediaId: string; title?: string; publicTags?: string[]; url?: string }>,
): Promise<void> {
  if (cachedIcons.length === icons.length) return // already embedded

  const ext = await getExtractor()

  cachedIcons = icons.map((i) => ({
    mediaId: i.mediaId,
    title: i.title ?? '',
    tags: i.publicTags ?? [],
    url: i.url ?? '',
    ref: `yoto:#${i.mediaId}`,
  }))

  // Build search corpus: "title tag1 tag2 tag3"
  const corpus = cachedIcons.map((i) => [i.title, ...i.tags].join(' '))

  const embeddings = await ext(corpus, { pooling: 'mean', normalize: true })
  cachedVectors = embeddings.tolist() as number[][]
}

/**
 * Find the best matching icon for a given track title.
 * Requires embedIcons() to have been called first.
 */
export async function matchIcon(title: string, topK = 1): Promise<IconMatch[]> {
  if (cachedVectors.length === 0) {
    return []
  }

  const ext = await getExtractor()
  const queryEmb = await ext([title], { pooling: 'mean', normalize: true })
  const queryVec = (queryEmb.tolist() as number[][])[0]!

  const scored = cachedVectors.map((vec, i) => ({
    score: cosineSim(queryVec, vec),
    icon: cachedIcons[i]!,
  }))

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, topK).map((s) => ({
    mediaId: s.icon.mediaId,
    ref: s.icon.ref,
    title: s.icon.title,
    url: s.icon.url,
    score: Math.round(s.score * 1000) / 1000,
  }))
}

/**
 * Check if the embedding model and icon corpus are loaded.
 */
export function isReady(): boolean {
  return cachedVectors.length > 0
}
