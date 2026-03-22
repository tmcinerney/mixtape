import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Track } from '../types/yoto'
import type { DisplayIcon } from '@yotoplay/yoto-sdk'
import { IconPicker } from './icon-picker'
import '../styles/track-list.css'

export type { Track }

interface TrackListProps {
  tracks: Track[]
  onReorder: (tracks: Track[]) => void
  onDelete: (index: number) => void
  onTitleChange: (index: number, title: string) => void
  onIconChange?: (index: number, iconRef: string, iconUrl: string) => void
}

interface SortableTrackProps {
  track: Track
  index: number
  onDelete: (index: number) => void
  onTitleChange: (index: number, title: string) => void
  onIconChange?: (index: number, iconRef: string, iconUrl: string) => void
}

function SortableTrack({
  track,
  index,
  onDelete,
  onTitleChange,
  onIconChange,
}: SortableTrackProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.key,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} role="listitem" className="track-list-item">
      {/* AIDEV-NOTE: Drag handle — only this element triggers drag, not the whole row */}
      <button
        className="track-list-drag-handle"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <span className="track-list-number">{index + 1}</span>
      <TrackIcon
        {...(track.iconUrl !== undefined ? { icon: track.iconUrl } : {})}
        {...(onIconChange
          ? { onSelect: (ref: string, url: string) => onIconChange(index, ref, url) }
          : {})}
      />
      <input
        type="text"
        value={track.title}
        onChange={(e) => onTitleChange(index, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        aria-label="Track title"
        className="track-list-title-input"
      />
      <DeleteButton onConfirm={() => onDelete(index)} />
    </div>
  )
}

// AIDEV-NOTE: Track icon — shows current icon or a placeholder. Click opens icon picker popover.
function TrackIcon({
  icon,
  onSelect,
}: {
  icon?: string
  onSelect?: (ref: string, url: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!onSelect) {
    // Read-only — just show the icon
    return icon ? (
      <img src={icon} alt="" className="track-list-icon" />
    ) : (
      <span className="track-list-icon-placeholder" />
    )
  }

  return (
    <div className="track-list-icon-wrapper" ref={ref}>
      <button
        className="track-list-icon-btn"
        onClick={() => setOpen(!open)}
        aria-label="Change track icon"
      >
        {icon ? (
          <img src={icon} alt="" className="track-list-icon" />
        ) : (
          <span className="track-list-icon-placeholder">+</span>
        )}
      </button>
      {open ? (
        <div className="track-list-icon-popover">
          <IconPicker
            onSelect={(selected: DisplayIcon) => {
              onSelect(`yoto:#${selected.mediaId}`, selected.url)
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

// AIDEV-NOTE: Two-click delete — first click shows "confirm?", auto-resets after 3s.
function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleClick = useCallback(() => {
    if (confirming) {
      if (timerRef.current) clearTimeout(timerRef.current)
      onConfirm()
    } else {
      setConfirming(true)
      timerRef.current = setTimeout(() => setConfirming(false), 3000)
    }
  }, [confirming, onConfirm])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <button
      onClick={handleClick}
      aria-label={confirming ? 'Confirm delete' : 'Delete track'}
      className={`track-list-delete-btn ${confirming ? 'track-list-delete-btn--confirm' : ''}`}
    >
      {confirming ? 'Delete?' : '✕'}
    </button>
  )
}

export function TrackList({
  tracks,
  onReorder,
  onDelete,
  onTitleChange,
  onIconChange,
}: TrackListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tracks.findIndex((t) => t.key === active.id)
    const newIndex = tracks.findIndex((t) => t.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const next = [...tracks]
    const [moved] = next.splice(oldIndex, 1)
    next.splice(newIndex, 0, moved!)
    // AIDEV-NOTE: re-key chapters with zero-padded two-digit keys after reorder
    onReorder(rekey(next))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tracks.map((t) => t.key)} strategy={verticalListSortingStrategy}>
        <div role="list" aria-label="Track list">
          {tracks.map((track, i) => (
            <SortableTrack
              key={track.key}
              track={track}
              index={i}
              onDelete={onDelete}
              onTitleChange={onTitleChange}
              {...(onIconChange ? { onIconChange } : {})}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

// AIDEV-NOTE: re-assign zero-padded two-digit keys ("00", "01", ...) after reorder
function rekey(tracks: Track[]): Track[] {
  return tracks.map((t, i) => ({
    ...t,
    key: String(i).padStart(2, '0'),
  }))
}
