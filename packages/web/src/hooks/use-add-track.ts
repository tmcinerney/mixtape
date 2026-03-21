import { useCallback, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'

interface Chapter {
  title: string
  format: 'opus'
  channels: 'stereo'
  type: 'audio'
  url: string
}

interface AddTrackParams {
  cardId: string
  mediaUrl: string
  title: string
}

// AIDEV-NOTE: required defaults for Yoto card content updates
const CARD_DEFAULTS = {
  activity: 'none' as const,
  restricted: false,
  version: 2,
  config: { onlineOnly: true },
}

export function useAddTrack() {
  const { sdk } = useYoto()
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addTrack = useCallback(
    async ({ cardId, mediaUrl, title }: AddTrackParams) => {
      if (!sdk) throw new Error('Yoto SDK not ready')

      setIsAdding(true)
      setError(null)

      try {
        const cardData = await sdk.content.getCard(cardId)
        const existingChapters = (cardData.content?.chapters ?? {}) as Record<string, Chapter>

        // AIDEV-NOTE: next key is zero-padded number after highest existing key
        const existingKeys = Object.keys(existingChapters).map(Number)
        const nextKey = existingKeys.length > 0 ? Math.max(...existingKeys) + 1 : 0
        const paddedKey = String(nextKey).padStart(2, '0')

        const newChapter: Chapter = {
          title,
          format: 'opus',
          channels: 'stereo',
          type: 'audio',
          url: mediaUrl,
        }

        const updatedChapters = {
          ...existingChapters,
          [paddedKey]: newChapter,
        }

        await sdk.content.updateCard(cardId, {
          ...CARD_DEFAULTS,
          chapters: updatedChapters,
        })
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
