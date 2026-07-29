# Build context MUST be the monorepo root (see docker-compose.yml / CI workflow), not this
# directory — @sofsavdo/api has no workspace-internal dependencies, but it's still an npm-workspaces
# package: npm needs the root package.json/package-lock.json to resolve and install it correctly.

FROM node:22-alpine AS deps
WORKDIR /app
# Only manifests in this layer so `npm ci` is cached across builds that don't touch dependencies.
# Every workspace's package.json must be present, not just @sofsavdo/api's — package-lock.json
# describes the whole monorepo, and `npm ci` needs to find each workspace it references on disk
# to validate against it, even though only @sofsavdo/api's dependencies actually end up used here.
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
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY apps/api ./apps/api
COPY package.json package-lock.json ./
# Prisma's generated client is real, imported code (PrismaClient), not a runtime-only artifact —
# it must exist before `nest build`'s TypeScript compilation, exactly like running it locally.
# `generate` never connects to this — prisma.config.ts only needs a syntactically valid URL to
# load without throwing; no real database exists at build time.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npm run prisma:generate --workspace=@sofsavdo/api
RUN npm run build --workspace=@sofsavdo/api

FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm ci --omit=dev

# Distroless-ish minimal runtime — no build tools, no dev dependencies, no source outside dist/.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S sofsavdo && adduser -S sofsavdo -G sofsavdo
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY apps/api/package.json ./apps/api/package.json
# Schema + migrations only (not seed.ts/scripts/ — those are dev/CI-only, run via `docker exec`
# or a separate CI step, never baked into what this image starts automatically; see the
# "Production must never run destructive seed logic automatically" requirement in ENVIRONMENT.md).
COPY apps/api/prisma/schema.prisma ./apps/api/prisma/schema.prisma
COPY apps/api/prisma/migrations ./apps/api/prisma/migrations
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
USER sofsavdo
WORKDIR /app/apps/api
EXPOSE 4000
# Does NOT run `prisma migrate deploy` here — migrations are a separate, explicit CI/CD step (see
# DEPLOYMENT.md) so that scaling this image to multiple replicas never races several instances
# into applying the same migration concurrently on container start.
CMD ["node", "dist/src/main.js"]
