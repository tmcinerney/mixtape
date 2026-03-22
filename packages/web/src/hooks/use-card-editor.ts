import { useCallback, useEffect, useRef, useState } from 'react'
import { useYoto } from '../auth/yoto-provider'
import { useYotoQuery } from './use-yoto-query'
import type { Track, Chapter, CardData } from '../types/yoto'

// AIDEV-NOTE: Convert chapters array to flat track list for the UI.
// Each chapter becomes one "track" — we use the first track's URL.
export function chaptersToTracks(chapters: Chapter[]): Track[] {
  return chapters.map((ch) => {
    const firstTrack = ch.tracks[0]
    // AIDEV-NOTE: Extract icon ref from chapter.display.icon16x16 — Yoto stores
    // icons as "yoto:#mediaId" references. Resolved to URLs via useIconResolver.
    const display = ch.display as { icon16x16?: string } | undefined
    const iconRef = display?.icon16x16
    return {
      key: ch.key,
      title: ch.title ?? firstTrack?.title ?? 'Untitled',
      trackUrl: firstTrack?.trackUrl ?? '',
      format: firstTrack?.format ?? 'opus',
      channels: firstTrack?.channels ?? 'stereo',
      type: firstTrack?.type ?? 'audio',
      ...(firstTrack?.duration !== undefined ? { duration: firstTrack.duration } : {}),
      ...(iconRef !== undefined ? { iconRef } : {}),
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
    // AIDEV-NOTE: Write icon ref back to chapter.display.icon16x16
    const originalDisplay = (original?.display ?? {}) as Record<string, unknown>
    const display =
      t.iconRef !== undefined ? { ...originalDisplay, icon16x16: t.iconRef } : originalDisplay

    return {
      ...original,
      key,
      ...(t.title !== undefined ? { title: t.title } : {}),
      overlayLabel: String(i + 1),
      ...(Object.keys(display).length > 0 ? { display } : {}),
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
  handleIconChange: (index: number, iconRef: string, iconUrl: string) => void
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

  // AIDEV-NOTE: save accepts optional overrides so callers can pass the new state
  // directly without waiting for React to re-render and update the refs.
  const save = useCallback(
    async (overrides?: { tracks?: Track[]; title?: string }) => {
      if (!sdk || !card || !cardId) return

      const saveTracks = overrides?.tracks ?? tracksRef.current
      const saveTitle = overrides?.title ?? titleRef.current

      setSaveStatus('saving')
      setSaveError(null)

      try {
        const payload = {
          ...card,
          cardId,
          title: saveTitle,
          content: {
            ...card.content,
            chapters: tracksToChapters(saveTracks, originalChaptersRef.current),
          },
        }
        await sdk.content.updateCard(
          payload as unknown as Parameters<typeof sdk.content.updateCard>[0],
        )
        setSaveStatus('saved')
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), SAVED_DISPLAY_MS)
      } catch (err) {
        setSaveStatus('error')
        setSaveError(err instanceof Error ? err.message : 'Failed to save')
      }
    },
    [sdk, card, cardId],
  )

  const saveNow = useCallback(
    (overrides?: { tracks?: Track[]; title?: string }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      save(overrides)
    },
    [save],
  )

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

  const handleIconChange = useCallback(
    (index: number, iconRef: string, iconUrl: string) => {
      const updated = tracksRef.current.map((t, i) =>
        i === index ? { ...t, iconRef, iconUrl } : t,
      )
      setTracks(updated)
      saveNow({ tracks: updated })
    },
    [saveNow],
  )

  const handleDelete = useCallback(
    (index: number) => {
      const filtered = tracksRef.current.filter((_, i) => i !== index)
      const rekeyed = filtered.map((t, i) => ({ ...t, key: String(i).padStart(2, '0') }))
      setTracks(rekeyed)
      saveNow({ tracks: rekeyed })
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
      saveNow({ tracks: newTracks })
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
    handleIconChange,
    handleDelete,
    saveNow,
    saveLater,
    retry: saveNow,
  }
}
