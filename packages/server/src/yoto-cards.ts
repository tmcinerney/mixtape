// AIDEV-NOTE: Yoto API base from yoto.dev/api docs — same as yoto-upload.ts
const YOTO_API_BASE = 'https://api.yotoplay.com'

// AIDEV-NOTE: Card defaults matching the official MYO portal structure
const MYO_CARD_DEFAULTS = {
  activity: 'yoto_Player',
  restricted: true,
  version: '1',
}

const MYO_CONFIG_DEFAULTS = {
  resumeTimeout: 2592000,
  onlineOnly: false,
}

export async function createCard(
  title: string,
  coverUrl: string | undefined,
  token: string,
): Promise<string> {
  const metadata: Record<string, unknown> = { title }
  if (coverUrl) {
    metadata.cover = { imageL: coverUrl }
  }

  const resp = await fetch(`${YOTO_API_BASE}/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      content: { ...MYO_CARD_DEFAULTS, config: MYO_CONFIG_DEFAULTS, chapters: [] },
      metadata,
    }),
  })

  if (!resp.ok) throw new Error(`Failed to create card: ${resp.status}`)
  const data = await resp.json()
  return data.card?.cardId ?? data.cardId
}

export async function addChapterToCard(
  cardId: string,
  chapter: { title: string; mediaUrl: string; index: number; iconUrl?: string },
  token: string,
): Promise<void> {
  // Fetch existing card
  const getResp = await fetch(`${YOTO_API_BASE}/content/${cardId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!getResp.ok) throw new Error(`Failed to fetch card: ${getResp.status}`)
  const existing = (await getResp.json()) as { card: Record<string, unknown> }
  const card = existing.card
  const content = (card.content ?? {}) as Record<string, unknown>
  const chapters = ((content.chapters ?? []) as unknown[]).slice()

  // Build new chapter
  const paddedKey = String(chapter.index).padStart(2, '0')
  const newChapter = {
    key: paddedKey,
    title: chapter.title,
    overlayLabel: String(chapter.index + 1),
    ...(chapter.iconUrl ? { display: { icon16x16: chapter.iconUrl } } : {}),
    tracks: [
      {
        key: '01',
        trackUrl: chapter.mediaUrl,
        format: 'opus',
        channels: 'stereo',
        type: 'audio',
        overlayLabel: String(chapter.index + 1),
      },
    ],
  }

  chapters.push(newChapter)

  // Update card with retry-once logic
  const updatePayload = {
    ...card,
    cardId,
    content: {
      ...MYO_CARD_DEFAULTS,
      ...content,
      config: { ...MYO_CONFIG_DEFAULTS, ...(content.config ?? {}) },
      chapters,
    },
    metadata: card.metadata ?? {},
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const putResp = await fetch(`${YOTO_API_BASE}/content/${cardId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updatePayload),
    })
    if (putResp.ok) return
    if (attempt === 0) continue // retry once
    throw new Error(`Failed to update card after retry: ${putResp.status}`)
  }
}
