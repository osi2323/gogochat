FROM node:20-alpine AS base
WORKDIR /app
# pnpm'i global olarak kur
RUN npm install -g pnpm

# -----------------------------------------------------------------------------
# Bağımlılıkların kurulduğu katman (Tüm bağımlılıklar)
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# -----------------------------------------------------------------------------
# Geliştirme katmanı
FROM deps AS dev
COPY . .
CMD ["pnpm", "dev"]

# -----------------------------------------------------------------------------
# Builder katmanı
FROM deps AS builder
COPY . .
RUN pnpm build

# -----------------------------------------------------------------------------
# Production runtime
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Minimal gereklilikleri kopyala
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Güvenli kullanıcı
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
