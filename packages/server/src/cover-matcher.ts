// AIDEV-NOTE: Semantic cover matching for Yoto MYO cards.
// Embeds 22 Yoto cover image names once and finds closest semantic match for a card title.
// Returns CDN URLs with randomly-varied colors for visual variety.
import { getExtractor, cosineSim } from './icon-matcher'

const COVER_IMAGES = [
  'apple',
  'bee',
  'book',
  'cactus',
  'cat-keytar',
  'cherries',
  'cloud',
  'diamond',
  'drum',
  'fish',
  'flower',
  'ghost',
  'ice-cream',
  'lolly',
  'microphone',
  'radio',
  'rocket',
  'skull',
  'star',
  'strawberry',
  'sun',
  'unicorn',
]
const COVER_COLORS = ['blue', 'grapefruit', 'green', 'lilac', 'mint', 'orange', 'red', 'yellow']

function buildCoverUrl(image: string, color: string): string {
  return `https://cdn.yoto.io/myo-cover/${image}_${color}.gif`
}

let cachedCoverVectors: number[][] = []
let cachedCoverEntries: Array<{ image: string; color: string; url: string }> = []

async function ensureEmbeddings(): Promise<void> {
  if (cachedCoverVectors.length > 0) return
  const ext = await getExtractor()

  cachedCoverEntries = COVER_IMAGES.map((image) => {
    const color = COVER_COLORS[0]! // embed with first color — image name drives semantics
    return { image, color, url: buildCoverUrl(image, color) }
  })

  const corpus = cachedCoverEntries.map((e) => e.image.replace(/-/g, ' '))
  const embeddings = await ext(corpus, { pooling: 'mean', normalize: true })
  cachedCoverVectors = embeddings.tolist() as number[][]
}

export async function matchCovers(title: string, topK = 5): Promise<string[]> {
  if (!title.trim()) {
    // Random fallback
    const img = COVER_IMAGES[Math.floor(Math.random() * COVER_IMAGES.length)]!
    const clr = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]!
    return [buildCoverUrl(img, clr)]
  }

  await ensureEmbeddings()
  const ext = await getExtractor()
  const queryEmb = await ext([title], { pooling: 'mean', normalize: true })
  const queryVec = (queryEmb.tolist() as number[][])[0]!

  const scored = cachedCoverVectors.map((vec, i) => ({
    score: cosineSim(queryVec, vec),
    entry: cachedCoverEntries[i]!,
  }))
  scored.sort((a, b) => b.score - a.score)

  // For each top image, pick a random color to add variety
  return scored.slice(0, topK).map((s) => {
    const color = COVER_COLORS[Math.floor(Math.random() * COVER_COLORS.length)]!
    return buildCoverUrl(s.entry.image, color)
  })
}
