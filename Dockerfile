# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --legacy-peer-deps

# Stage 2: Builder (Next.js build + Prisma client)
FROM node:20-bookworm-slim AS builder

RUN apt-get update && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Migrator (Prisma CLI + schema only — not the Next.js runtime)
# Used as a one-shot Compose service before `app` starts.
FROM node:20-bookworm-slim AS migrator

RUN apt-get update && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
COPY scripts/docker-migrate.sh ./scripts/docker-migrate.sh
COPY scripts/docker-migrate.mjs ./scripts/docker-migrate.mjs

RUN chmod +x ./scripts/docker-migrate.sh \
    && npx prisma generate

ENTRYPOINT ["./scripts/docker-migrate.sh"]

# Stage 4: Runner (lean standalone Next.js — no Prisma CLI / no full node_modules)
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid 1001 --system nextjs \
    && mkdir -p .next uploads

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN chmod -R 755 public .next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
