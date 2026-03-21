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

RUN pnpm --filter shared build && pnpm --filter server build

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
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built shared (dist + src for type resolution)
COPY --from=build-server /app/packages/shared/dist/ packages/shared/dist/
COPY --from=build-server /app/packages/shared/src/ packages/shared/src/

# AIDEV-NOTE: Patch shared exports to resolve to compiled JS in production.
# In dev, exports point to ./src/index.ts (for tsx/vite), but Node needs .js.
RUN node -e " \
  const pkg = JSON.parse(require('fs').readFileSync('packages/shared/package.json','utf8')); \
  pkg.exports['.'].default = './dist/index.js'; \
  require('fs').writeFileSync('packages/shared/package.json', JSON.stringify(pkg, null, 2) + '\n'); \
"

# Copy built server
COPY --from=build-server /app/packages/server/dist/ packages/server/dist/

# Copy built web assets
COPY --from=build-web /app/packages/web/dist/ packages/web/dist/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
