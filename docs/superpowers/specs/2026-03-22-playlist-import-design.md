# Playlist Import & Unified Upload Flow

**Date:** 2026-03-22
**Status:** Approved
**Project:** Mixtape Web App

## Overview

Add YouTube playlist import to Mixtape — paste a playlist URL, auto-create a new Yoto card with all tracks. Simultaneously, unify the single-track and playlist flows into one pipeline, improving the existing single-track UX by moving confirmation before download.

## Mental Model

```
Paste URL → Extract Metadata → Confirm → Import → Done
```

This applies regardless of whether the input is 1 track or 50.

## Key Decisions

| Decision                       | Choice                                                | Rationale                                                                    |
| ------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| Playlist → card mapping        | 1 playlist = 1 new card                               | Simplest mental model, no card selection step                                |
| Confirm timing                 | Before download                                       | Fixes current UX where user waits for download before choosing title         |
| Card cover                     | AI-matched Yoto CDN cover (176 options)               | Free, instant, native aesthetic. Architecture supports DALL-E later.         |
| Error handling                 | Best-effort — skip failures, report summary           | Too strict to abort a 20-track import for one private video                  |
| Progress reporting             | Two-tier: "Track X of Y" + per-track steps            | Reuses existing step indicators, adds overall counter                        |
| Playlist size limits           | Pre-flight smart cap using yt-dlp metadata            | Validates duration/count against Yoto limits before downloading              |
| Job architecture               | Single mega-job per playlist import                   | Simple client (one SSE, one cancel), fits existing queue model               |
| Metadata extraction            | Synchronous REST endpoint (not SSE)                   | Fast enough (~2-5s) without needing streaming progress                       |
| Flow unification               | Single-track becomes a special case of playlist (N=1) | Less total code, shared runner/schemas/components                            |
| Ambiguous URL (`v=` + `list=`) | Ask user: "Full playlist or just this video?"         | Avoids surprising the user with a 20-track import when they pasted one video |

## Discovered API: Yoto Cover Image Upload

Reverse-engineered from `my.yotoplay.com` portal's `coverImageDetail.jsx` component. Not exposed in the SDK.

### Endpoints

**Direct file upload:**

```
POST api.yotoplay.com/media/coverImage/user/me/upload?coverType=default
Authorization: Bearer <yoto-token>
Content-Type: <image-mime-type>
Body: raw image bytes
→ { coverImage: { mediaUrl: "https://..." } }
```

**Upload from URL:**

```
POST api.yotoplay.com/media/coverImage/user/me/upload?imageUrl=<url>&coverType=default
Authorization: Bearer <yoto-token>
Body: empty
→ { coverImage: { mediaUrl: "https://..." } }
```

**Pre-made covers (no API call):**

```
https://cdn.yoto.io/myo-cover/{image}_{color}.gif
```

22 images × 8 colors = 176 covers.

Images: apple, bee, book, cactus, cat-keytar, cherries, cloud, diamond, drum, fish, flower, ghost, ice-cream, lolly, microphone, radio, rocket, skull, star, strawberry, sun, unicorn.

Colors: blue, grapefruit, green, lilac, mint, orange, red, yellow.

**How covers are saved:** The portal sets `metadata.cover.imageL = <url>` on the card object and saves via the normal `updateCard` API. No special endpoint for associating a cover — it's just a metadata field.

## API Design

### GET /api/metadata?url=...

Extracts metadata for a YouTube URL (single video or playlist) without downloading.

**Auth:** Requires Yoto auth token in `Authorization` header. While yt-dlp itself doesn't need auth, this prevents abuse of the AI title suggestion calls and rate-limits the endpoint to authenticated users.

**Implementation:**

- Single video: `yt-dlp --dump-json <url>` (~2s)
- Playlist: `yt-dlp --flat-playlist --dump-json <url>` (~3-5s)
- AI title suggestion: single call for the card title. Per-track titles use `sanitizeTitle()` (regex-based, no API call) during metadata extraction. AI-cleaned `suggestedTitle` per track is deferred to the import job to avoid 50× gpt-4o-mini calls in a synchronous request.

**Response (Zod schema: `MetadataResponseSchema`):**

```typescript
MetadataResponseSchema = z.object({
  type: z.enum(['video', 'playlist']),
  title: z.string(), // Original YouTube title
  suggestedTitle: z.string(), // AI-cleaned card title (gpt-4o-mini)
  coverOptions: z.array(z.string().url()), // 3-5 matched CDN cover URLs
  totalDuration: z.number(), // seconds
  truncatedAt: z.number().optional(), // Index where Yoto limit cuts off
  tracks: z.array(
    z.object({
      videoId: z.string(),
      title: z.string(), // Original YouTube title
      suggestedTitle: z.string(), // Regex-cleaned title (sanitizeTitle)
      duration: z.number(), // seconds
    }),
  ),
})
```

For a single video, `tracks` has one entry. The schema is the same either way.

**Validation:** If total duration > 5 hours or track count > 100, set `truncatedAt` to the index where the cutoff happens. The UI shows a warning.

### POST /api/jobs/import

Unified import job. Creates or uses a card, downloads and uploads all tracks sequentially.

**Request (Zod schema: `ImportJobRequestSchema`):**

```typescript
ImportJobRequestSchema = z
  .object({
    url: z.string().url(), // YouTube URL (single video or playlist)
    cardId: z.string().optional(), // Existing card — omit to create new
    cardTitle: z.string().max(100).optional(), // Title for new card (required if no cardId)
    coverUrl: z.string().url().optional(), // Cover image URL for new card
    tracks: z.array(
      z.object({
        videoId: z.string(),
        title: z.string(), // Confirmed title to use
      }),
    ),
    yotoToken: z.string(),
  })
  .refine((d) => d.cardId || d.cardTitle, { message: 'Either cardId or cardTitle is required' })
```

**SSE events (Zod schema: `ImportProgressSchema`):**

Replaces the existing `JobProgressSchema`. The old `POST /api/jobs` endpoint and its schema are removed entirely (not kept for backward compat) — there are no external consumers.

```typescript
ImportProgressSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('card-created'), cardId: z.string() }),
  z.object({
    type: z.literal('track-start'),
    index: z.number(),
    total: z.number(),
    title: z.string(),
  }),
  z.object({
    type: z.literal('track-progress'),
    step: z.enum(['download', 'upload', 'transcode']),
    progress: z.number(),
  }),
  z.object({ type: z.literal('track-complete'), index: z.number() }),
  z.object({
    type: z.literal('track-skipped'),
    index: z.number(),
    title: z.string(),
    reason: z.string(),
  }),
  z.object({
    type: z.literal('complete'),
    cardId: z.string(),
    imported: z.number(),
    skipped: z.array(z.object({ title: z.string(), reason: z.string() })),
  }),
  z.object({ type: z.literal('cancelled'), cardId: z.string(), imported: z.number() }),
  z.object({ type: z.literal('error'), message: z.string() }),
])
```

**Note on `convert` step removal:** The existing `JobProgressSchema` had a `convert` step that was never actually emitted by `job-runner.ts` — audio conversion is handled internally by yt-dlp's `--extract-audio` flag during the download step. The new schema drops it. The three steps (download, upload, transcode) reflect the actual pipeline.

For single-track imports to an existing card, `card-created` is not emitted and events use `index: 0, total: 1`.

### GET /api/cover/match?title=...

Returns top 3-5 semantically matched Yoto CDN cover URLs for a given title.

Uses embeddings (same `@huggingface/transformers` + `all-MiniLM-L6-v2` as existing icon matcher) to compare title against the 22 cover image names.

**When used:** Called when the user edits the card title on the confirmation screen and wants fresh cover suggestions. Also called internally by `GET /api/metadata` to populate the initial `coverOptions`. The `🔄` button on the confirmation screen cycles through the returned options; if exhausted, it can re-fetch with the updated title.

### POST /api/cover/upload — OUT OF SCOPE

Proxies image upload to Yoto's cover image endpoint. Documented here for reference (API details in "Discovered API" section above) but **not implemented in this iteration**. Only needed when we add AI-generated covers (DALL-E). The current flow uses pre-made CDN URLs which don't require upload.

## UI Flow

### Six states

1. **URL Input** — existing component, enhanced with playlist URL detection regex.

2. **Disambiguation** (conditional) — `Disambiguation` component, shown only when URL has both `v=` and `list=` params. Two buttons: "Import full playlist (20 tracks)" / "Just this video". Selecting one transitions to extracting. This is a **separate screen**, not inline in the URL input — the state machine's `disambiguating` state renders this component.

3. **Loading Metadata** — spinner/cassette animation while `GET /api/metadata` runs (~2-5s). Shows "Fetching playlist info..." or "Fetching video info..."

4. **Confirmation** — `ImportConfirm` component adapts based on context. For single-track imports, card selection is part of this screen (inline card selector within the confirmation view — not a separate state). The `confirming` state handles both card selection and track/title confirmation as one step.

   |               | Single track, existing card    | Single track, new card         | Playlist                    |
   | ------------- | ------------------------------ | ------------------------------ | --------------------------- |
   | Card          | Card selector                  | Title (editable) + cover       | Title (editable) + cover    |
   | Tracks        | Title (editable) + icon picker | Title (editable) + icon picker | Scrollable list (read-only) |
   | Cover         | Not shown                      | AI-matched, cycleable          | AI-matched, cycleable       |
   | Button        | "Add Track"                    | "Create & Add"                 | "Import N Tracks"           |
   | Limit warning | N/A                            | N/A                            | Shown if truncated          |

5. **Import Progress** — `ImportProgress` component:
   - N=1: per-track step indicators only (download/upload/process), no "X of Y" counter
   - N>1: overall progress bar ("Track 3 of 20") + per-track steps + completed track list scrolling below
   - Cancel link: finishes current track upload, keeps partial card

6. **Completion** — `ImportComplete` component:
   - N=1: "Added to [card name]" with "View Card" / "Add Another" buttons
   - N>1: "Imported 18/20 tracks to [card name]" with skipped track details, same buttons
   - If cancelled: "Imported 12 tracks (cancelled)" with link to partial card

### State machine (use-import-flow.ts)

Replaces existing `use-upload-flow.ts`:

```
idle
  → extracting          (user submits URL)
  → disambiguating      (URL has both v= and list=)

disambiguating
  → extracting          (user chooses playlist or single)

extracting
  → confirming          (metadata received)
  → idle                (extraction failed, show error)

confirming
  → importing           (user confirms)
  → idle                (user cancels)

importing
  → complete            (all tracks processed)
  → cancelled           (user cancels mid-import)
  → idle                (fatal error)

complete
  → idle                (user clicks "Add Another")

cancelled
  → idle                (user clicks "Import Another")
```

## Backend Architecture

### New files

| File                                              | Purpose                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `packages/server/src/routes/metadata.ts`          | `GET /api/metadata` — yt-dlp metadata extraction                          |
| `packages/server/src/routes/cover.ts`             | `GET /api/cover/match` (cover upload endpoint deferred — see API section) |
| `packages/server/src/import-runner.ts`            | Unified job runner: create card + download/upload N tracks                |
| `packages/server/src/cover-matcher.ts`            | Semantic matching against 22 Yoto cover images × 8 colors                 |
| `packages/server/src/youtube-metadata.ts`         | yt-dlp `--flat-playlist --dump-json` wrapper                              |
| `packages/shared/src/schemas.ts`                  | New schemas (extended, not replaced)                                      |
| `packages/web/src/hooks/use-import-flow.ts`       | Unified state machine hook                                                |
| `packages/web/src/components/import-confirm.tsx`  | Pre-download confirmation screen                                          |
| `packages/web/src/components/import-progress.tsx` | Two-tier progress display                                                 |
| `packages/web/src/components/import-complete.tsx` | Completion summary                                                        |
| `packages/web/src/components/disambiguation.tsx`  | "Full playlist or just this video?" prompt                                |

### Modified files

| File                                        | Change                                                            |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `packages/server/src/routes/jobs.ts`        | Add `POST /api/jobs/import` route, deprecate old `POST /api/jobs` |
| `packages/server/src/icon-matcher.ts`       | Extract shared embedding logic, add cover image corpus            |
| `packages/web/src/pages/landing.tsx`        | Wire up new `useImportFlow` hook, render new components per state |
| `packages/web/src/api/client.ts`            | Add `fetchMetadata()`, `startImport()`, `matchCover()` methods    |
| `packages/web/src/components/url-input.tsx` | Add playlist URL detection regex                                  |

### Deprecated files (to be removed)

| File                                                                       | Replaced by                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/server/src/job-runner.ts`                                        | `import-runner.ts`                                |
| `packages/server/src/routes/jobs.ts` (old `POST /api/jobs`)                | `POST /api/jobs/import` in same file              |
| `packages/shared/src/schemas.ts` (`JobProgressSchema`, `JobRequestSchema`) | `ImportProgressSchema`, `ImportJobRequestSchema`  |
| `packages/web/src/hooks/use-upload-flow.ts`                                | `use-import-flow.ts`                              |
| `packages/web/src/hooks/use-add-track.ts`                                  | Logic moves into `import-runner.ts` (server-side) |
| `packages/web/src/components/track-confirm.tsx`                            | `import-confirm.tsx`                              |
| `packages/web/src/components/upload-progress.tsx`                          | `import-progress.tsx`                             |
| `packages/web/src/components/upload-confirmation.tsx`                      | `import-complete.tsx`                             |

### Reused as-is

| File                                    | Notes                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/youtube.ts`        | Single video download, called in loop by import-runner                                                                                                                                                        |
| `packages/server/src/yoto-upload.ts`    | S3 upload + transcode polling, called per track                                                                                                                                                               |
| `packages/server/src/suggest-title.ts`  | AI title cleaning, called in metadata route                                                                                                                                                                   |
| `packages/server/src/sanitize-title.ts` | Regex fallback for title cleaning                                                                                                                                                                             |
| `packages/server/src/job-queue.ts`      | Queue mechanics unchanged. `JobEntry` type updated to accept `ImportJobRequest` instead of old `JobRequest`. This is a type change only — the queue's concurrency, cleanup, and promotion logic don't change. |

## Error Handling

### URL edge cases

| URL pattern                          | Behavior                                                  |
| ------------------------------------ | --------------------------------------------------------- |
| `youtube.com/playlist?list=PLxxx`    | Playlist flow                                             |
| `youtube.com/watch?v=xxx`            | Single video flow                                         |
| `youtube.com/watch?v=xxx&list=PLxxx` | Disambiguation: "Full playlist or just this video?"       |
| `youtube.com/watch?v=xxx&list=WL`    | Reject: "Watch Later playlists can't be imported"         |
| `youtube.com/watch?v=xxx&list=LL`    | Reject: "Liked Videos playlists can't be imported"        |
| `youtube.com/playlist?list=RDxxx`    | Treat as playlist (auto-generated mix), smart cap applies |
| Private/deleted playlist             | Error during metadata extraction with reason              |

### Per-track failures (during import)

| Error           | Behavior                                     |
| --------------- | -------------------------------------------- |
| Private video   | Skip, reason: "Private video"                |
| Age-restricted  | Skip, reason: "Age-restricted"               |
| Region-locked   | Skip, reason: "Unavailable in your region"   |
| Video not found | Skip, reason: "Video unavailable"            |
| Video > 60 min  | Skip, reason: "Exceeds track duration limit" |
| Network timeout | Retry once, then skip                        |
| yt-dlp crash    | Skip, reason: "Download failed"              |

### Yoto API failures

| Error                    | Behavior                                                      |
| ------------------------ | ------------------------------------------------------------- |
| Card creation fails      | Abort import, surface error (nothing to recover)              |
| updateCard fails         | Retry once, then skip track                                   |
| Cover upload fails       | Fall back to no cover, continue import                        |
| Token expired mid-import | Emit error event, stop import. Card retains completed tracks. |

### Token expiry mitigation

Check token expiry (`exp` claim in JWT) before starting import. If remaining time < estimated import duration (track count × ~30s), warn user: "Your session may expire during this import. Please re-authenticate first."

### Cancellation

Cancel signal finishes the current track's upload (so it's not wasted), then stops. Card retains all completed tracks as a valid partial card. Emits `{type: 'cancelled', cardId, imported: N}`.

## Concurrency

- Import job occupies 1 of 3 concurrent queue slots for its full duration
- A 20-track import may take 10-15 minutes
- No change to max concurrent (3) — this is a personal tool, not a shared service
- Tracks within a job are processed sequentially (no parallel downloads)

## Future Enhancements (not in scope)

- **AI-generated covers** — DALL-E / GPT-4o pixel art generation via the discovered upload endpoint
- **Add playlist to existing card** — currently always creates new card
- **Track filtering** — remove individual tracks on the confirmation screen
- **Parallel track downloads** — download multiple tracks simultaneously within a job
- **Playlist URL sharing** — share a Mixtape link that auto-imports a playlist
- **Cover image editing** — in card editor, using the cover upload endpoint for any card
