# ReachInbox – Distributed Email Scheduler

> Standalone, production-grade distributed email scheduling and queue processing system built with Node.js, Express, TypeScript, PostgreSQL (Prisma ORM), Redis (Lua-atomic rate limiting), BullMQ, and Elasticsearch.

[![Tests](https://img.shields.io/badge/tests-38%20passed-success)](https://github.com/reachinbox/reachinbox-distributed-email-scheduler)
[![Node.js](https://img.shields.io/badge/node.js-v22+-339933?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-v5+-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2015+-336791?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/queue-BullMQ%20%2B%20Redis-red?logo=redis)](https://redis.io/)
[![Elasticsearch](https://img.shields.io/badge/search-Elasticsearch%208+-005571?logo=elasticsearch)](https://www.elastic.co/)

---

## 1. System Architecture

```
                       ┌───────────────────────────────────────────────┐
                       │          ReachInbox Web Dashboard             │
                       │    (Live Monitor, Composer, Search Explorer)  │
                       └───────────────────────┬───────────────────────┘
                                               │ REST API / JWT
                                               ▼
                       ┌───────────────────────────────────────────────┐
                       │        Standalone Express API Engine          │
                       │     (Zod Validation, Tenant Context, Auth)    │
                       └───────┬───────────────┬───────────────┬───────┘
                               │               │               │
           ┌───────────────────┴───┐   ┌───────┴──────┐   ┌───┴───────────────────┐
           ▼                       ▼   ▼              ▼   ▼                       ▼
   ┌───────────────┐       ┌───────────────┐  ┌───────────────┐       ┌───────────────┐
   │  PostgreSQL   │       │    Redis 7    │  │ Elasticsearch │       │  SMTP Server  │
   │  (Prisma ORM) │       │ (BullMQ + Lua)│  │ (Full-Text)   │       │ (Nodemailer)  │
   └───────────────┘       └───────┬───────┘  └───────────────┘       └───────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  BullMQ Worker Pool   │
                       │  - Rate Limit Check   │
                       │  - Retries & Backoff  │
                       │  - Dead Letter Queue  │
                       └───────────────────────┘
```

### Core Engineering Capabilities

1. **Redis Lua Atomic Throttling**:
   - Zero race conditions across multiple concurrent workers.
   - Sliding-window algorithm pruning stale events using `ZREMRANGEBYSCORE`.
   - Redis cluster hash-tag `{tenantId}` partitioning.

2. **BullMQ Distributed Queue**:
   - Millisecond precision scheduled execution via delay offsets.
   - Exponential backoff retry policies (`attempts: 3`, `backoff: 3000ms`).
   - Dead letter queue alerting and manual retry capabilities.

3. **Multi-Tenant Persistence (PostgreSQL & Prisma)**:
   - Strict tenant isolation enforced at the database layer.
   - Relational schemas for `Tenant`, `User`, `Campaign`, `EmailJob`, `RateLimitConfig`, and `AuditLog`.
   - Tracked migrations in `prisma/migrations`.

4. **Elasticsearch 8 Full-Text Search**:
   - English language analyzers and custom tokenizers.
   - Boolean filtered search queries strictly bounded to `tenantId`.
   - HTML highlight tags for immediate UI matching.

5. **Security & Authentication**:
   - Google OAuth 2.0 ID token cryptographic verification (`verifyIdToken`).
   - Slack OAuth state token nonce validation against CSRF.
   - JWT session management with tenant role-based access control (`ADMIN`, `OPERATOR`, `MEMBER`).
   - Sensitive credential masking in logs and health check responses.

---

## 2. Quick Start with Docker Compose

Run the complete software stack (PostgreSQL, Redis, Elasticsearch, and the Scheduler application) with a single command:

```bash
docker-compose up --build
```

The application dashboard will be accessible at [http://localhost:3000](http://localhost:3000).

---

## 3. Local Development Setup

### Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- PostgreSQL 15+
- Redis 7+
- Elasticsearch 8+

### Setup Commands
```bash
# 1. Clone repository
git clone https://github.com/reachinbox/reachinbox-distributed-email-scheduler.git
cd reachinbox-distributed-email-scheduler

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Configure environment
cp .env.example .env

# 4. Generate Prisma Client
npx prisma generate

# 5. Apply Database Migrations
npx prisma migrate deploy

# 6. Run Automated Test Suite
npm test

# 7. Start Full-Stack Development Server
npm run dev
```

---

## 4. Available NPM Scripts

| Script | Command | Description |
|---|---|---|
| `npm run dev` | `tsx server.ts` | Start full-stack development server with Vite middleware |
| `npm run build` | `vite build` | Build production frontend bundle |
| `npm run start` | `tsx server.ts` | Start production server |
| `npm test` | `node --import tsx --test tests/**/*.test.ts` | Run all 38 automated test suites |
| `npm run typecheck` | `tsc --noEmit` | Validate TypeScript types across the entire project |
| `npm run generate-zip`| `tsx scripts/generate_zip.ts` | Generate standalone source ZIP archive |

---

## 5. Automated Test Results

All 38 automated tests execute directly using Node.js's built-in test runner:

```text
TAP version 13
# tests 38
# suites 9
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

- **API Validation**: 3 tests passed
- **Authentication & Security**: 4 tests passed
- **Prisma Schema & Modeling**: 6 tests passed
- **Elasticsearch Queries**: 4 tests passed
- **BullMQ Distributed Queue**: 5 tests passed
- **Redis Lua Rate Limiting**: 5 tests passed
- **Slack Alerts & OAuth**: 3 tests passed
- **SMTP Email Delivery**: 3 tests passed
- **Tenant Isolation**: 5 tests passed

---

## 6. Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server port | `3000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://reachinbox:...@localhost:5432/...` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | Elasticsearch cluster endpoint | `http://localhost:9200` |
| `SMTP_HOST` | Outgoing SMTP host | `smtp.ethereal.email` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | - |
| `SLACK_WEBHOOK_URL`| Slack Incoming Webhook URL | - |
| `JWT_SECRET` | Secret key for signing session tokens | - |

---

## 7. Production Deployment Guide

### Deploying with Docker
```bash
docker build -t reachinbox-scheduler:latest .
docker run -p 3000:3000 --env-file .env reachinbox-scheduler:latest
```

### Deploying to Cloud Providers (AWS / GCP / Render / Railway)
1. Provision managed PostgreSQL (AWS RDS / GCP Cloud SQL / Neon).
2. Provision managed Redis (AWS ElastiCache / Redis Enterprise / Upstash).
3. Set the environment variables in your deployment dashboard (`DATABASE_URL`, `REDIS_URL`, `ELASTICSEARCH_URL`, `JWT_SECRET`).
4. Run `npx prisma migrate deploy` in the build/release step.
5. Launch the application process with `npm start`.

---

## 8. Standalone Distribution Archive

The complete standalone source archive is packaged as:
`reachinbox-distributed-email-scheduler.zip`

Available for download directly from the dashboard or through the REST endpoint:
`GET /api/zip/download`

---

## License

Apache-2.0. Copyright (c) ReachInbox.
