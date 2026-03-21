import { useCallback, useEffect, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import { useYotoQuery } from './use-yoto-query'
import type { Track, Chapter, CardData } from '../types/yoto'

// AIDEV-NOTE: Convert chapters array to flat track list for the UI.
// Each chapter becomes one "track" — we use the first track's URL.
export function chaptersToTracks(chapters: Chapter[]): Track[] {
  return chapters.map((ch) => {
    const firstTrack = ch.tracks[0]
    return {
      key: ch.key,
      title: ch.title ?? firstTrack?.title ?? 'Untitled',
      trackUrl: firstTrack?.trackUrl ?? '',
      format: firstTrack?.format ?? 'opus',
      channels: firstTrack?.channels ?? 'stereo',
      type: firstTrack?.type ?? 'audio',
      ...(firstTrack?.duration !== undefined ? { duration: firstTrack.duration } : {}),
    }
  })
}

// AIDEV-NOTE: Convert flat track list back to chapters array for the API.
// Each track becomes a chapter with a single-element tracks array.
export function tracksToChapters(tracks: Track[], originalChapters: Chapter[]): Chapter[] {
  return tracks.map((t, i) => {
    // Preserve original chapter data (display, ambient, etc) if it exists
    const original = originalChapters.find((ch) => ch.key === t.key)
    const key = String(i).padStart(2, '0')
    return {
      ...original,
      key,
      ...(t.title !== undefined ? { title: t.title } : {}),
      overlayLabel: String(i + 1),
      tracks: [
        {
          ...(original?.tracks[0] ?? {}),
          key: '01',
          trackUrl: t.trackUrl,
          format: t.format,
          channels: t.channels,
          type: t.type,
          ...(t.title !== undefined ? { title: t.title } : {}),
          overlayLabel: String(i + 1),
        },
      ],
    }
  })
}

export interface UseCardEditorResult {
  card: CardData | null
  title: string
  setTitle: (title: string) => void
  tracks: Track[]
  setTracks: (tracks: Track[]) => void
  loading: boolean
  saving: boolean
  error: string | null
  handleTitleChange: (index: number, newTitle: string) => void
  handleDelete: (index: number) => void
  handleSave: () => Promise<void>
}

export function useCardEditor(cardId: string | undefined): UseCardEditorResult {
  const { sdk } = useYoto()
  const [originalChapters, setOriginalChapters] = useState<Chapter[]>([])
  const [title, setTitle] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [saving, setSaving] = useState(false)

  const {
    data: card,
    loading,
    error,
  } = useYotoQuery<CardData>(
    (s) => s.content.getCard(cardId!).then((r) => r as unknown as CardData),
    [cardId],
  )

  // Sync fetched card data into local editing state
  useEffect(() => {
    if (!card) return
    const chapters = (card.content?.chapters ?? []) as unknown as Chapter[]
    setOriginalChapters(chapters)
    setTitle(card.title)
    setTracks(chaptersToTracks(chapters))
  }, [card])

  const handleTitleChange = useCallback((index: number, newTitle: string) => {
    setTracks((prev) => prev.map((t, i) => (i === index ? { ...t, title: newTitle } : t)))
  }, [])

  const handleDelete = useCallback((index: number) => {
    setTracks((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.map((t, i) => ({ ...t, key: String(i).padStart(2, '0') }))
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!sdk || !card || !cardId) return

    setSaving(true)
    try {
      // AIDEV-NOTE: merge onto existing card data, include cardId for update
      const payload = {
        ...card,
        cardId,
        title,
        content: {
          ...card.content,
          chapters: tracksToChapters(tracks, originalChapters),
        },
      }
      await sdk.content.updateCard(
        payload as unknown as Parameters<typeof sdk.content.updateCard>[0],
      )
    } finally {
      setSaving(false)
    }
  }, [sdk, card, cardId, title, tracks, originalChapters])

  return {
    card,
    title,
    setTitle,
    tracks,
    setTracks,
    loading,
    saving,
    error,
    handleTitleChange,
    handleDelete,
    handleSave,
  }
}
