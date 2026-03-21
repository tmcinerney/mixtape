import '../styles/cassette-loader.css'

interface CassetteLoaderProps {
  /** Progress 0-100. When undefined, shows indeterminate spinning animation. */
  progress?: number
  label?: string
}

// AIDEV-NOTE: Spool radius math — models real tape transfer.
// Total tape area is constant. As progress goes from 0→100, tape transfers
// from left spool to right spool. Using area-based formula: r = sqrt(area/π).
const HUB_RADIUS = 3
const MIN_SPOOL = 4
const MAX_SPOOL = 12

function spoolRadii(progress: number) {
  const p = Math.max(0, Math.min(100, progress)) / 100
  const maxArea = MAX_SPOOL * MAX_SPOOL
  const minArea = MIN_SPOOL * MIN_SPOOL
  const leftArea = maxArea - p * (maxArea - minArea)
  const rightArea = minArea + p * (maxArea - minArea)
  return {
    left: Math.sqrt(leftArea),
    right: Math.sqrt(rightArea),
  }
}

// AIDEV-NOTE: SVG cassette with progress-driven spool sizes.
// Left spool starts full, shrinks as tape transfers to right spool.
// Reels spin at speeds inversely proportional to their radius (like a real tape).
export function CassetteLoader({ progress, label = 'Processing...' }: CassetteLoaderProps) {
  const hasProgress = progress !== undefined
  const { left: leftR, right: rightR } = hasProgress
    ? spoolRadii(progress)
    : { left: MAX_SPOOL, right: MIN_SPOOL }

  // Spin speed: smaller spool = faster rotation (angular velocity inversely proportional to radius)
  const leftSpeed = hasProgress ? 0.8 + (1 - leftR / MAX_SPOOL) * 1.2 : 1.5
  const rightSpeed = hasProgress ? 0.8 + (1 - rightR / MAX_SPOOL) * 1.2 : 1.2

  return (
    <div className="cassette-loader" role="status" aria-label={label}>
      <svg
        className="cassette-svg"
        viewBox="0 0 120 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Cassette body */}
        <rect
          x="4"
          y="8"
          width="112"
          height="64"
          rx="8"
          stroke="var(--color-primary)"
          strokeWidth="2.5"
        />

        {/* Tape window */}
        <rect
          x="20"
          y="20"
          width="80"
          height="28"
          rx="4"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          opacity="0.4"
        />

        {/* Tape path — connects the two spools through the bottom of the window */}
        <path
          d={`M ${42 + leftR} 34 L ${78 - rightR} 34`}
          stroke="var(--color-primary)"
          strokeWidth="0.75"
          opacity="0.3"
        />

        {/* Left spool — tape source */}
        <g
          className="cassette-reel"
          style={{
            transformOrigin: '42px 34px',
            animationDuration: `${leftSpeed}s`,
          }}
        >
          {/* Tape wound on spool */}
          <circle cx="42" cy="34" r={leftR} fill="var(--color-primary)" opacity="0.12" />
          {/* Spool outline */}
          <circle
            cx="42"
            cy="34"
            r={leftR}
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Hub */}
          <circle cx="42" cy="34" r={HUB_RADIUS} fill="var(--color-primary)" />
          {/* Spokes */}
          <line
            x1="42"
            y1={34 - leftR + 1}
            x2="42"
            y2={34 - HUB_RADIUS}
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <line
            x1="42"
            y1={34 + HUB_RADIUS}
            x2="42"
            y2={34 + leftR - 1}
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <line
            x1={42 - leftR + 1}
            y1="34"
            x2={42 - HUB_RADIUS}
            y2="34"
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <line
            x1={42 + HUB_RADIUS}
            y1="34"
            x2={42 + leftR - 1}
            y2="34"
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
        </g>

        {/* Right spool — tape destination */}
        <g
          className="cassette-reel"
          style={{
            transformOrigin: '78px 34px',
            animationDuration: `${rightSpeed}s`,
          }}
        >
          {/* Tape wound on spool */}
          <circle cx="78" cy="34" r={rightR} fill="var(--color-primary)" opacity="0.12" />
          {/* Spool outline */}
          <circle
            cx="78"
            cy="34"
            r={rightR}
            stroke="var(--color-primary)"
            strokeWidth="1.5"
            fill="none"
          />
          {/* Hub */}
          <circle cx="78" cy="34" r={HUB_RADIUS} fill="var(--color-primary)" />
          {/* Spokes */}
          <line
            x1="78"
            y1={34 - rightR + 1}
            x2="78"
            y2={34 - HUB_RADIUS}
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <line
            x1="78"
            y1={34 + HUB_RADIUS}
            x2="78"
            y2={34 + rightR - 1}
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <line
            x1={78 - rightR + 1}
            y1="34"
            x2={78 - HUB_RADIUS}
            y2="34"
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
          <line
            x1={78 + HUB_RADIUS}
            y1="34"
            x2={78 + rightR - 1}
            y2="34"
            stroke="var(--color-primary)"
            strokeWidth="1"
          />
        </g>

        {/* Label strip */}
        <rect
          x="30"
          y="54"
          width="60"
          height="10"
          rx="2"
          fill="var(--color-primary)"
          opacity="0.15"
        />
      </svg>
      <span className="cassette-label">{label}</span>
    </div>
  )
}
