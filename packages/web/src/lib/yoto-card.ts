// AIDEV-NOTE: One source of truth for MYO card content defaults.
//
// These used to be duplicated: use-add-track.ts had one set and create-card-dialog.tsx
// had another, and they had drifted apart. The dialog sent `chapters: {}` and
// `version: 2`, which Yoto now rejects outright:
//
//   body.content.chapters: Invalid input: expected array, received object
//   body.content.version:  Invalid input: expected string, received number
//
// Types confirmed against yoto.dev/reference/card-content-schema:
//   content.chapters -> array
//   content.version  -> string
//
// The drift was worse than the 400. use-add-track merges
// `{...MYO_CARD_DEFAULTS, ...existingContent}`, so existing content wins — a card born
// in the dialog kept `activity: 'none'` and `onlineOnly: true` for life, meaning it
// never downloaded to the player. Keep both callers on this one object.
export const MYO_CARD_DEFAULTS = {
  activity: 'yoto_Player',
  restricted: true,
  version: '1',
} as const

export const MYO_CONFIG_DEFAULTS = {
  resumeTimeout: 2592000,
  onlineOnly: false,
} as const
