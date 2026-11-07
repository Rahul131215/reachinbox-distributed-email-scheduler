# Multi-stage production build for ReachInbox Distributed Scheduler

# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build frontend
RUN npm run build


# Stage 2: Production runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./

# Install production dependencies and tsx
RUN npm ci --omit=dev --legacy-peer-deps && npm install --no-save --legacy-peer-deps tsx@^4.21.0

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]