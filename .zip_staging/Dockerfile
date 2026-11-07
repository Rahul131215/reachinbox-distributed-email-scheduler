# Multi-stage production build for ReachInbox Distributed Scheduler
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY prisma ./prisma/

RUN npm ci --legacy-peer-deps

COPY . .

# Generate Prisma Client & Build Vite Frontend
RUN npx prisma generate
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/server ./src/server
COPY --from=builder /app/server.ts ./server.ts

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
