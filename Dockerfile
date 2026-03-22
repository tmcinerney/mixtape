# AIDEV-NOTE: Multi-stage build — deps → build-web → build-server → runtime
# Keeps runtime image small with only production deps + system binaries

# ── Stage 1: Install all dependencies ──────────────────────────────────────────
FROM node:22-slim AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build web (Vite SPA) ─────────────────────────────────────────────
FROM deps AS build-web

COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/
COPY tsconfig.base.json tsconfig.json ./

RUN pnpm --filter shared build && pnpm --filter web build

# ── Stage 3: Build server ─────────────────────────────────────────────────────
FROM deps AS build-server

COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY tsconfig.base.json tsconfig.json ./

# AIDEV-NOTE: tsup bundles @mixtape/shared via noExternal, no need to build shared first
RUN pnpm --filter server build

# ── Stage 4: Production runtime ───────────────────────────────────────────────
FROM node:22-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      python3-pip \
      pipx && \
    pipx install yt-dlp && \
    apt-get purge -y python3-pip pipx && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# AIDEV-NOTE: pipx installs to /root/.local/bin
ENV PATH="/root/.local/bin:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config and package manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# AIDEV-NOTE: tsup bundles shared into server — no shared dist/src needed at runtime
# Copy built server
COPY --from=build-server /app/packages/server/dist/ packages/server/dist/

# Copy built web assets
COPY --from=build-web /app/packages/web/dist/ packages/web/dist/

# AIDEV-NOTE: Pre-download the embedding model for semantic icon matching (~90MB).
# Cached to ~/.cache/huggingface so it's baked into the image.
RUN cd packages/server && node -e " \
  import('@huggingface/transformers').then(m => \
    m.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' }) \
  ).then(() => console.log('Embedding model downloaded'))"

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
