# mixtape

Make mixtapes for your Yoto cards.

A lightweight web app for converting YouTube audio into playlists on [Yoto](https://yotoplay.com) MYO cards. Paste a YouTube URL, pick a card, and the audio lands on your kid's Yoto player.

## Features

- Paste a YouTube URL → audio extracted and uploaded to a Yoto card
- AI-suggested track names (cleans up noisy YouTube titles via OpenAI)
- Editable title + icon picker before adding a track
- Lightweight card management (track list, reorder, rename, icon picker)
- Dark mode with system preference detection
- Family-friendly — each user logs in with their own Yoto account
- Self-hosted via Docker + Cloudflare Tunnel

## Tech Stack

- **Frontend**: Vite + React 19 (TypeScript), Auth0 PKCE, Yoto SDK
- **Backend**: Hono (TypeScript), yt-dlp, ffmpeg, OpenAI API
- **Shared**: Zod schemas for SSE protocol types
- **Monorepo**: pnpm workspaces (`packages/web`, `packages/server`, `packages/shared`)

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9.x
- Docker (for dev environment with yt-dlp/ffmpeg)

### Setup

```bash
# Clone and install
git clone git@github.com:tmcinerney/mixtape.git
cd mixtape
pnpm install

# Configure environment
cp .env.example .env
# Edit .env — add your OPENAI_API_KEY (optional, falls back to basic title cleanup)
```

### Development

**With Docker (recommended)** — includes yt-dlp + ffmpeg:

```bash
docker compose up
```

- Vite dev server: http://localhost:5173
- Hono API server: http://localhost:3001

Both hot-reload on file changes.

**Without Docker** — requires yt-dlp and ffmpeg installed locally:

```bash
pnpm dev
```

### Testing

```bash
pnpm test          # Run all tests
pnpm typecheck     # TypeScript check
pnpm lint          # ESLint
```

### Production

```bash
docker compose -f docker-compose.prod.yml up --build
```

Single container serving the SPA + API on port 3001.

## Architecture

See [DESIGN.md](DESIGN.md) for the full design document.
