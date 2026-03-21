// AIDEV-NOTE: Canonical Yoto types for the web package. These represent the
// shapes returned by the Yoto SDK after it unwraps raw API responses.
// All card/chapter/track code should import from here — not define inline.

/** A single audio track within a chapter. */
export interface Track {
  key: string
  trackUrl: string
  format: string
  channels: string
  type: string
  title?: string
  duration?: number
  overlayLabel?: string
  /** Forward-compat: preserve unknown fields from the SDK/API. */
  [k: string]: unknown
}

/** A chapter on a Yoto card — typically one chapter per "track" in the UI. */
export interface Chapter {
  key: string
  title?: string
  tracks: Track[]
  overlayLabel?: string
  /** Forward-compat: preserve unknown fields from the SDK/API. */
  [k: string]: unknown
}

/**
 * Shape returned by sdk.content.getCard() after the SDK unwraps
 * the raw { card: ... } API response.
 */
export interface CardData {
  cardId: string
  title: string
  metadata: Record<string, unknown>
  content: Record<string, unknown>
}
