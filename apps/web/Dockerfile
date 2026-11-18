# --- Этап 1: Зависимости ---
FROM node:22-alpine AS deps
WORKDIR /app

COPY apps/web/package*.json ./apps/web/
RUN cd apps/web && npm ci

# --- Этап 2: Сборка Next.js ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY apps/web ./apps/web
COPY libs/shared ./libs/shared

ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd apps/web && npm run build

# --- Этап 3: Минимальный раннер ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Копируем standalone-сервер и статику в корень /app
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./public

USER node

EXPOSE 3000

CMD ["node", "server.js"]
