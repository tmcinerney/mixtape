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
import '../styles/track-list.css'

export type { Track }

interface TrackListProps {
  tracks: Track[]
  onReorder: (tracks: Track[]) => void
  onDelete: (index: number) => void
  onTitleChange: (index: number, title: string) => void
}

interface SortableTrackProps {
  track: Track
  index: number
  onDelete: (index: number) => void
  onTitleChange: (index: number, title: string) => void
}

function SortableTrack({ track, index, onDelete, onTitleChange }: SortableTrackProps) {
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
      <input
        type="text"
        value={track.title}
        onChange={(e) => onTitleChange(index, e.target.value)}
        aria-label="Track title"
        className="track-list-title-input"
      />
      <button
        onClick={() => onDelete(index)}
        aria-label="Delete track"
        className="track-list-delete-btn"
      >
        ✕
      </button>
    </div>
  )
}

export function TrackList({ tracks, onReorder, onDelete, onTitleChange }: TrackListProps) {
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
