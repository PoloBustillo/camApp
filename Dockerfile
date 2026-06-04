FROM oven/bun:1-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Dependencias ────────────────────────────────────────
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ─── Desarrollo ──────────────────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ./node_modules/.bin/prisma generate
EXPOSE 3000
CMD ["bun", "run", "dev"]

# ─── Build de producción ─────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN ./node_modules/.bin/prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# ─── Migrador (etapa dedicada con CLI de Prisma) ─────────
FROM base AS migrator
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY package.json ./
CMD ["./node_modules/.bin/prisma", "migrate", "deploy"]

# ─── Producción ──────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Prisma necesita sus binarios nativos en el standalone output
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["bun", "server.js"]
