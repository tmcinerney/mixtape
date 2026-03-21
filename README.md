# mixtape

Make mixtapes for your Yoto cards.

A lightweight web app for converting YouTube audio into playlists on [Yoto](https://yotoplay.com) MYO cards. Paste a YouTube URL, pick a card, and the audio lands on your kid's Yoto player.

## Status

Design phase — see [DESIGN.md](DESIGN.md) for the full design document and [.stitch/DESIGN.md](.stitch/DESIGN.md) for the Stitch design system.

## Features (planned)

- Paste a YouTube URL → audio extracted and uploaded to a Yoto card
- Lightweight card management (track list, reorder, rename, icon picker)
- Dark mode
- Family-friendly — each user logs in with their own Yoto account
- Self-hosted via Docker + Cloudflare Tunnel

## Architecture

- **Frontend**: Static SPA with Yoto OAuth (PKCE)
- **Backend**: Minimal TypeScript job runner (yt-dlp + ffmpeg + Yoto SDK)
- **Deployment**: Docker on homelab, Cloudflare Tunnel for access
