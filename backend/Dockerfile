# Prisma 엔진은 Alpine(musl)에서 OpenSSL 감지/로드 이슈가 잦음 → Debian(glibc) 기반 사용
# ---------- Build stage ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm install

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate && npm run build

# ---------- Runtime stage ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
