# Build context MUST be the monorepo root (see docker-compose.yml / CI workflow) — @sofsavdo/web
# depends on the workspace-internal @sofsavdo/config, @sofsavdo/types, @sofsavdo/ui packages (transpiled
# from their TS source directly, see next.config.ts's transpilePackages), so the whole monorepo
# needs to be present for the install/build steps, not just apps/web.

FROM node:22-alpine AS deps
WORKDIR /app
# Every workspace's package.json must be present (see apps/api/Dockerfile's deps stage comment
# for why) — this is doubly true here since @sofsavdo/web actually depends on the workspace-internal
# packages below, and a plain, unscoped `npm ci` is what reliably reproduces the exact same
# node_modules layout (including where each @sofsavdo/* symlink ends up) as everyone's local install.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY packages/config ./packages/config
COPY packages/types ./packages/types
COPY packages/ui ./packages/ui
# Real values are supplied at container runtime for anything NEXT_PUBLIC_*-free; these two are
# baked in at build time because Next.js inlines NEXT_PUBLIC_* vars into the client bundle — see
# ENVIRONMENT.md for why that means a real deploy must set them as build ARGs, not just runtime
# env vars, or the shipped bundle will silently keep pointing at whatever was set here.
ARG NEXT_PUBLIC_API_MODE=real
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_MODE=$NEXT_PUBLIC_API_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build --workspace=@sofsavdo/web

# Minimal runtime — output:"standalone" (next.config.ts) traces only the dependencies this build
# actually needs into .next/standalone, so the image doesn't need the full node_modules tree.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S sofsavdo && adduser -S sofsavdo -G sofsavdo
COPY --from=build /app/apps/web/.next/standalone ./
# Static assets are deliberately excluded from the standalone trace and must be copied separately
# — the one Next.js Docker step it's easy to forget and get a 404-riddled production build from.
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
USER sofsavdo
WORKDIR /app/apps/web
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
