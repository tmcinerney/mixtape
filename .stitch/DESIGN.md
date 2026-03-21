# Design System: Mixtape

**Project ID:** 7206254568036833641
**Stitch Project:** [Mixtape — Final Designs](https://stitch.withgoogle.com/projects/7206254568036833641)
**Exploration:** [Yoto Web — Mockups](https://stitch.withgoogle.com/projects/12098196550268625219)

## 1. Visual Theme & Atmosphere

Warm utility — friendly and approachable without being childish. Inspired by the Yoto brand's tactile, playful-but-premium aesthetic. Generous whitespace, fully rounded shapes, no hard edges. Feels like a high-end toy store display, not a corporate SaaS dashboard. The interface should feel like a shared family tool — simple enough for a non-technical parent, warm enough that it doesn't feel like a developer utility.

## 2. Color Palette & Roles

### Light Mode
- **Primary**: Coral-orange (#E8654B) — header bar, CTAs, accents, brand moments
- **Background**: Warm off-white (#F8F5F0) — main page surface
- **Surface**: Slightly warmer (#F6F3EE) — for inset areas, input fields, secondary containers
- **Text Primary**: Dark charcoal (#1C1C19) — headings and body text
- **Text Secondary**: Muted charcoal (#58413D) — labels, captions, metadata
- **Links**: Blue (#3B82C4) — matching Yoto's link style
- **Success**: Green (#38A169) — completed steps, checkmarks
- **Card backgrounds**: Saturated per-card colors (light blue, teal, orange, green) — each card is distinct

### Dark Mode
- **Primary**: Coral-orange (#E8654B) — unchanged, stays vibrant
- **Background**: Dark charcoal (#1C1C19) — main surface
- **Surface**: Slightly lighter charcoal (#2E2F2D) — for cards, containers
- **Text Primary**: Warm off-white (#F8F5F0) — headings and body
- **Text Secondary**: Muted warm (#AEADAA) — labels, metadata
- **Card backgrounds**: Same saturated colors — pop more against dark

## 3. Typography Rules

- **Font Family**: Plus Jakarta Sans — clean, modern, geometric with open apertures
- **Brand Mark**: "mixtape" in lowercase, medium weight — approachable and conversational
- **Heading (H1)**: Plus Jakarta Sans, ExtraBold, 3rem (48px), tight tracking
- **Heading (H2)**: Plus Jakarta Sans, Bold, 1.5rem (24px)
- **Body**: Plus Jakarta Sans, Regular, 1.125rem (18px)
- **Labels/Captions**: Plus Jakarta Sans, SemiBold, 0.875rem (14px)
- **Accent text**: "mixtapes" and "Yoto cards" in coral italic within headings for emphasis

## 4. Brand Identity

- **Name**: Mixtape
- **Icon**: Cassette reel — two small circles (8px diameter) connected by a short horizontal line, representing cassette tape reels viewed from above. Shape: O—O
- **Icon colors**: White on coral header backgrounds, coral on light backgrounds, warm off-white on dark backgrounds
- **Loading animation**: Cassette reels spin/rotate while audio is downloading, converting, or uploading. Dashed motion lines around the reels suggest movement. Coral tones in light mode, lighter tones in dark mode.

## 5. Component Stylings

- **Buttons (Primary)**: Coral-orange (#E8654B), pill-shaped (fully rounded), white text. Scale to 1.05 on hover, scale to 0.95 on press for tactile springy feedback
- **Buttons (Secondary)**: Outlined with coral border, coral text, transparent background
- **Inputs**: Large, fully rounded, surface background (#F6F3EE light / #2E2F2D dark). No border — use background color shift for definition. Link icon as visual anchor
- **Cards (Yoto-style)**: 2:3 aspect ratio (portrait, tall), fully rounded corners (1.5rem+), saturated solid background color, large centered white icon, card title in white text at bottom inside the card. Dashed border + neutral background for "Add Playlist" card. Scale to 1.02 on hover
- **Track rows**: Subtle background color shift between rows (no lines). Drag handle, track number, small icon, title, duration, file size, three-dot menu
- **Header**: Coral-orange bar, full width. White cassette reel icon + "mixtape" wordmark left. Dark mode toggle (sun/moon) + user avatar right
- **Footer**: Minimal — "© mixtape · Help · Log out" in muted text
- **Dark mode toggle**: Sun icon (light mode) / Moon icon (dark mode) in header

## 6. Layout Principles

- **Platform**: Web, Desktop-first (responsive but not mobile-native)
- **Max-width**: ~900px centered content area
- **Whitespace**: Generous — use spacing to create zones, not borders or lines
- **No-line rule**: No 1px borders for sectioning. Separation through background color shifts or tonal transitions only
- **Card grid**: 3-4 cards per row, gap between cards
- **Card editor**: Two-column — artwork left, track list right
- **Progress states**: Centered, focused content with cassette animation as visual anchor

## 7. Screens

### Landing Page (Light + Dark)
- Coral header with cassette icon + "mixtape", dark mode toggle, avatar
- "Make mixtapes for your Yoto cards." bold heading
- YouTube URL input + "Add to mixtape" coral pill button
- "Your Cards" with count, large immersive card grid
- Minimal footer

### Download/Processing State
- Centered cassette tape animation (spinning reels)
- 3-step horizontal progress: Download → Convert → Upload
- Video title shown, cancel link below

### Card Editor (Light + Dark)
- Back arrow in header
- Left: card artwork preview + title + "Change icon"
- Right: track list with "+ Add from YouTube", drag-reorderable rows
- Save/Cancel buttons at bottom

### Confirmation Screen
- Success state after upload — mixtape is ready
