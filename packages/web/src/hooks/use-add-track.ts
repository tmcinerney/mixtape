import { useCallback, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import type { Chapter } from '../types/yoto'

interface AddTrackParams {
  cardId: string
  mediaUrl: string
  title: string
  iconUrl?: string
}

// AIDEV-NOTE: Card defaults from yoto-mcp/src/tools/content.ts — matching
// the official MYO portal. These are merged onto existing card content.
const MYO_CARD_DEFAULTS = {
  activity: 'yoto_Player',
  restricted: true,
  version: '1',
}

const MYO_CONFIG_DEFAULTS = {
  resumeTimeout: 2592000,
  onlineOnly: false,
}

export function useAddTrack() {
  const { sdk } = useYoto()
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTrack = useCallback(
    async ({ cardId, mediaUrl, title, iconUrl }: AddTrackParams) => {
      if (!sdk) throw new Error('Yoto SDK not ready')

      setIsAdding(true)
      setError(null)

      try {
        // AIDEV-NOTE: Fetch existing card to merge onto — prevents data loss.
        // SDK returns { content, metadata, cardId, ... } as YotoJson.
        const existing = await sdk.content.getCard(cardId)
        const existingContent = (existing.content ?? {}) as Record<string, unknown>
        const existingChapters = (existingContent.chapters ?? []) as Chapter[]
        const existingConfig = (existingContent.config ?? {}) as Record<string, unknown>

        // AIDEV-NOTE: chapters is an array. Each chapter has a key (zero-padded),
        // tracks array, and overlayLabel. This matches yoto-mcp's format.
        const nextIndex = existingChapters.length
        const paddedKey = String(nextIndex).padStart(2, '0')

        const newChapter: Chapter = {
          key: paddedKey,
          title,
          overlayLabel: String(nextIndex + 1),
          // AIDEV-NOTE: Set chapter display icon if provided
          ...(iconUrl ? { display: { icon16x16: iconUrl } } : {}),
          // AIDEV-NOTE: Yoto API requires `trackUrl` (not `url`) and `key` on each track.
          // Confirmed via network inspection of real card payloads.
          tracks: [
            {
              key: '01',
              trackUrl: mediaUrl,
              format: 'opus',
              channels: 'stereo',
              type: 'audio',
              overlayLabel: String(nextIndex + 1),
            },
          ],
        }

        const updatedChapters = [...existingChapters, newChapter]

        // AIDEV-NOTE: updateCard needs cardId in payload for API to update (not create).
        // Merge defaults onto existing content to preserve fields we don't own.
        // Cast through unknown because YotoJson type doesn't include cardId.
        const payload = {
          ...existing,
          cardId,
          content: {
            ...MYO_CARD_DEFAULTS,
            ...existingContent,
            config: { ...MYO_CONFIG_DEFAULTS, ...existingConfig },
            chapters: updatedChapters,
          },
          metadata: existing.metadata ?? {},
        }
        await sdk.content.updateCard(
          payload as unknown as Parameters<typeof sdk.content.updateCard>[0],
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      } finally {
        setIsAdding(false)
      }
    },
    [sdk],
  )

  return { addTrack, isAdding, error }
}
