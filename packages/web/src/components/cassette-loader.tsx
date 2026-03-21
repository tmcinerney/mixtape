import '../styles/cassette-loader.css'

interface CassetteLoaderProps {
  label?: string
}

// AIDEV-NOTE: SVG cassette with two spinning reels — used during upload/download progress.
// Coral (#E8654B) in light mode, warm off-white (#F8F5F0) in dark mode via currentColor.
// The reels spin at different speeds to simulate tape movement.
export function CassetteLoader({ label = 'Processing...' }: CassetteLoaderProps) {
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
          fill="none"
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
          fill="none"
          opacity="0.4"
        />

        {/* Left reel */}
        <g className="cassette-reel" style={{ transformOrigin: '42px 34px' }}>
          <circle
            cx="42"
            cy="34"
            r="10"
            stroke="var(--color-primary)"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="42" cy="34" r="3" fill="var(--color-primary)" />
          {/* Spokes */}
          <line x1="42" y1="24" x2="42" y2="28" stroke="var(--color-primary)" strokeWidth="1.5" />
          <line x1="42" y1="40" x2="42" y2="44" stroke="var(--color-primary)" strokeWidth="1.5" />
          <line x1="32" y1="34" x2="36" y2="34" stroke="var(--color-primary)" strokeWidth="1.5" />
          <line x1="48" y1="34" x2="52" y2="34" stroke="var(--color-primary)" strokeWidth="1.5" />
        </g>

        {/* Right reel */}
        <g className="cassette-reel cassette-reel--right" style={{ transformOrigin: '78px 34px' }}>
          <circle
            cx="78"
            cy="34"
            r="10"
            stroke="var(--color-primary)"
            strokeWidth="2"
            fill="none"
          />
          <circle cx="78" cy="34" r="3" fill="var(--color-primary)" />
          {/* Spokes */}
          <line x1="78" y1="24" x2="78" y2="28" stroke="var(--color-primary)" strokeWidth="1.5" />
          <line x1="78" y1="40" x2="78" y2="44" stroke="var(--color-primary)" strokeWidth="1.5" />
          <line x1="68" y1="34" x2="72" y2="34" stroke="var(--color-primary)" strokeWidth="1.5" />
          <line x1="84" y1="34" x2="88" y2="34" stroke="var(--color-primary)" strokeWidth="1.5" />
        </g>

        {/* Tape between reels */}
        <line
          x1="52"
          y1="34"
          x2="68"
          y2="34"
          stroke="var(--color-primary)"
          strokeWidth="1"
          opacity="0.5"
        />

        {/* Label strip at bottom */}
        <rect
          x="30"
          y="54"
          width="60"
          height="10"
          rx="2"
          fill="var(--color-primary)"
          opacity="0.15"
        />

        {/* Motion lines — dashed arcs around reels */}
        <path
          className="cassette-motion-line"
          d="M 28 22 A 18 18 0 0 1 42 18"
          stroke="var(--color-primary)"
          strokeWidth="1"
          strokeDasharray="2 2"
          fill="none"
        />
        <path
          className="cassette-motion-line"
          d="M 92 22 A 18 18 0 0 0 78 18"
          stroke="var(--color-primary)"
          strokeWidth="1"
          strokeDasharray="2 2"
          fill="none"
        />
        <path
          className="cassette-motion-line"
          d="M 28 46 A 18 18 0 0 0 42 50"
          stroke="var(--color-primary)"
          strokeWidth="1"
          strokeDasharray="2 2"
          fill="none"
        />
      </svg>
      <span className="cassette-label">{label}</span>
    </div>
  )
}
