# Mixtape — Design Document

A lightweight web app for converting YouTube audio into playlists on Yoto MYO cards. Private family utility, not a public-facing product.

## Problem Statement

Adding YouTube audio to Yoto MYO cards currently requires either the MCP server via CLI/Claude or manual steps across multiple tools (yt-dlp, Yoto portal). Family members without technical setups can't do it at all. Mixtape lets anyone in the family paste a YouTube URL and get audio onto a Yoto card.

## Design References

- **Stitch final designs**: [Mixtape — Final Designs](https://stitch.withgoogle.com/projects/7206254568036833641)
- **Stitch exploration**: [Yoto Web — Mockups](https://stitch.withgoogle.com/projects/12098196550268625219)
- **Design system**: [`.stitch/DESIGN.md`](.stitch/DESIGN.md) — Stitch-optimized design tokens and component specs
- **My Yoto portal**: my.yotoplay.com — reference for card editor patterns

## Brand

- **Name**: Mixtape
- **Icon**: Cassette reel (O—O) — two circles connected by a line
- **Colors**: Coral-orange (#E8654B) primary, warm off-white (#F8F5F0) background
- **Font**: Plus Jakarta Sans
- **Dark mode**: Supported via toggle, system preference detection

## Core Flows

### 1. YouTube-to-Yoto Upload

1. User pastes YouTube URL into text box
2. User selects an existing card or creates a new one
3. Backend extracts audio via yt-dlp + ffmpeg (M4A preferred)
4. Backend uploads audio to Yoto (SHA256 → presigned URL → S3 → transcode polling)
5. AI suggests a clean track name (OpenAI gpt-4o-mini, runs in parallel with upload)
6. User sees a confirmation screen with the suggested title (editable) and optional icon picker
7. Track is added to the selected card with the chosen title and icon
8. User can further edit in the card editor (rename, reorder, delete)

### 2. Authentication

Two layers:

- **Cloudflare Access** (Google auth) — gates who can reach the site
- **Yoto OAuth** (Authorization Code + PKCE) — gates card management. Each family member logs in with their own Yoto account. Client-side, tokens in browser.

### 3. Lightweight Card Management

Not a My Yoto replacement — just enough to complete the upload flow:

- View card track list
- Reorder tracks
- Rename tracks
- Pick card icon (searchable with previews via Yoto API)
- Create new card

## Architecture

### Frontend

- **Vite + React** static SPA (TypeScript)
- Talks directly to Yoto API for card/icon operations using PKCE access token
- Calls backend only for YouTube download + Yoto upload
- OAuth: Authorization Code + PKCE with proactive silent refresh via refresh token
- Dark mode with system preference detection

### Backend

**Hono** (TypeScript) — minimal job runner:

- YouTube audio extraction (yt-dlp + ffmpeg)
- Upload to Yoto via raw fetch (SDK is browser-only; uses presigned S3 URLs + transcode polling)
- Progress reporting via **SSE** (download → convert → upload → transcode → complete with titles)
- AI title suggestion via OpenAI gpt-4o-mini (runs in parallel with upload, zero latency cost)
- Basic title sanitization (strips YouTube noise patterns) as fallback when no API key
- Validation with **Zod** (shared schemas with frontend)
- In-memory job queue with max 3 concurrent, auto-cleanup after 5 minutes
- Frontend passes Yoto access token per-job; backend never stores tokens
- Stateless — no database, no sessions
- Specific error messages for yt-dlp failures (private, age-restricted, region-locked)

### Repo Structure

Monorepo with shared types:

```
mixtape/
├── packages/
│   ├── web/          # Vite + React SPA
│   ├── server/       # Hono API
│   └── shared/       # Zod schemas, shared types
├── package.json      # Workspace root
├── tsconfig.base.json
├── Dockerfile        # Multi-stage production build
├── Dockerfile.dev    # Dev image with yt-dlp + ffmpeg
├── docker-compose.yml       # Dev environment (hot reload)
├── docker-compose.prod.yml  # Production build
└── DESIGN.md
```

### Deployment

- Single Docker image published to **GHCR** (GitHub Actions on push/tag)
- Backend serves SPA static files in production
- yt-dlp + ffmpeg baked into image
- Docker container on homelab
- Cloudflare Tunnel for family access
- Cloudflare Access with Google auth

### Audio Constraints

- Formats: MP3, AAC/M4A
- Per track: max 100 MB or 60 minutes
- Per card: max 100 tracks, 500 MB or 5 hours total
- Yoto transcodes to Opus server-side

## Screens

1. **Landing page** — YouTube URL input, card grid (light + dark)
2. **Card selector** — pick target card from user's library
3. **Processing state** — animated cassette loader, 3-step progress (download/convert/upload)
4. **Track confirmation** — AI-suggested title (editable), icon picker, add/cancel
5. **Card editor** — artwork + track list, two-column layout (light + dark)
6. **Success** — track added confirmation with "View Card" / "Add Another"

## Yoto API Surface

| Capability   | Used For                              |
| ------------ | ------------------------------------- |
| OAuth PKCE   | User login (client-side)              |
| List cards   | Card picker                           |
| Get card     | Track list, current state             |
| Create card  | New card from upload flow             |
| Update card  | Add tracks, reorder, rename, set icon |
| Upload audio | Upload extracted YouTube audio        |
| Search icons | Icon picker with previews             |

## Open Questions

- [x] Frontend framework → **Vite + React**
- [x] Backend framework → **Hono + Zod**
- [x] Progress reporting → **SSE**
- [x] Error handling → **Specific yt-dlp error mapping**
- [x] PKCE token refresh → **Proactive silent refresh via refresh token**
- [x] Upload flow → **Backend handles full pipeline** (frontend passes token per-job)
- [x] Backend rate limiting → **In-memory queue, max 3 concurrent jobs**
- [ ] Which homelab host (apollo vs hermes)

## Non-Goals (v1)

- Full card management (use my.yotoplay.com)
- Device control / playback
- Batch uploads
- Mobile-native app
- Multi-language / analytics
