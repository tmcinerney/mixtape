import '../styles/skeleton.css'

interface SkeletonProps {
  width?: string
  height?: string
  radius?: string
  className?: string
}

export function Skeleton({ width, height, radius, className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  )
}

/** Card grid placeholder — matches the section header + 2:3 portrait card layout */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div>
      <div className="card-grid-section-header">
        <Skeleton width="10ch" height="1.5rem" radius="var(--radius-sm)" />
        <Skeleton width="2ch" height="1rem" radius="var(--radius-sm)" />
      </div>
      <div className="card-grid">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton card-grid-skeleton" />
        ))}
      </div>
    </div>
  )
}

/** Track list placeholder — matches row layout with number, title, and button */
export function TrackListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="list" aria-label="Loading tracks">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="track-list-skeleton-row">
          <Skeleton width="2ch" height="1em" radius="4px" />
          <Skeleton width="100%" height="1.5em" radius="var(--radius-full)" />
          <Skeleton width="24px" height="24px" radius="var(--radius-full)" />
        </div>
      ))}
    </div>
  )
}
