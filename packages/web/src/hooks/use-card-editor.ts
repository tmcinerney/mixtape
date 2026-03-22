import { useCallback, useEffect, useRef, useState } from 'react'
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

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface UseCardEditorResult {
  card: CardData | null
  title: string
  setTitle: (title: string) => void
  tracks: Track[]
  setTracks: (tracks: Track[]) => void
  loading: boolean
  saveStatus: SaveStatus
  saveError: string | null
  error: string | null
  handleTitleChange: (index: number, newTitle: string) => void
  handleDelete: (index: number) => void
  /** Save immediately — used for discrete actions (reorder, delete) */
  saveNow: () => void
  /** Save after debounce — used for continuous input (title edits) */
  saveLater: () => void
  retry: () => void
}

const DEBOUNCE_MS = 1000
const SAVED_DISPLAY_MS = 2000

export function useCardEditor(cardId: string | undefined): UseCardEditorResult {
  const { sdk } = useYoto()
  const [originalChapters, setOriginalChapters] = useState<Chapter[]>([])
  const [title, setTitle] = useState('')
  const [tracks, setTracks] = useState<Track[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // AIDEV-NOTE: Refs for latest state so save() always uses current values
  // without needing them in the dependency array (which would cause re-renders).
  const titleRef = useRef(title)
  const tracksRef = useRef(tracks)
  const originalChaptersRef = useRef(originalChapters)
  titleRef.current = title
  tracksRef.current = tracks
  originalChaptersRef.current = originalChapters

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

  const save = useCallback(async () => {
    if (!sdk || !card || !cardId) return

    setSaveStatus('saving')
    setSaveError(null)

    try {
      const payload = {
        ...card,
        cardId,
        title: titleRef.current,
        content: {
          ...card.content,
          chapters: tracksToChapters(tracksRef.current, originalChaptersRef.current),
        },
      }
      await sdk.content.updateCard(
        payload as unknown as Parameters<typeof sdk.content.updateCard>[0],
      )
      setSaveStatus('saved')
      // Reset to idle after a brief "Saved" display
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_DISPLAY_MS)
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    }
  }, [sdk, card, cardId])

  const saveNow = useCallback(() => {
    // Clear any pending debounce
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    save()
  }, [save])

  const saveLater = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    debounceRef.current = setTimeout(() => save(), DEBOUNCE_MS)
  }, [save])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const handleTitleChange = useCallback(
    (index: number, newTitle: string) => {
      setTracks((prev) => prev.map((t, i) => (i === index ? { ...t, title: newTitle } : t)))
      saveLater()
    },
    [saveLater],
  )

  const handleDelete = useCallback(
    (index: number) => {
      setTracks((prev) => {
        const next = prev.filter((_, i) => i !== index)
        return next.map((t, i) => ({ ...t, key: String(i).padStart(2, '0') }))
      })
      // AIDEV-NOTE: Save immediately on delete — discrete, irreversible action
      // Use setTimeout(0) so the state update from setTracks is flushed first
      setTimeout(() => saveNow(), 0)
    },
    [saveNow],
  )

  // Wrapper setters that trigger saves
  const setTitleWithSave = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      saveLater()
    },
    [saveLater],
  )

  const setTracksWithSave = useCallback(
    (newTracks: Track[]) => {
      setTracks(newTracks)
      // AIDEV-NOTE: Immediate save on reorder (discrete action from DnD)
      setTimeout(() => saveNow(), 0)
    },
    [saveNow],
  )

  return {
    card,
    title,
    setTitle: setTitleWithSave,
    tracks,
    setTracks: setTracksWithSave,
    loading,
    saveStatus,
    saveError,
    error,
    handleTitleChange,
    handleDelete,
    saveNow,
    saveLater,
    retry: saveNow,
  }
}
