# ReachInbox Distributed Email Scheduler

> Production-grade, high-throughput distributed email scheduling and dispatch engine built with Node.js, TypeScript, PostgreSQL (Prisma ORM), Redis (Lua-atomic rate limiting), BullMQ, and Elasticsearch.

[![Tests](https://img.shields.io/badge/tests-38%20passed-success)](https://github.com/reachinbox/reachinbox-scheduler)
[![Node.js](https://img.shields.io/badge/node.js-v22+-blue)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL%2015+-336791)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/queue-BullMQ%20%2B%20Redis-red)](https://redis.io/)
[![Elasticsearch](https://img.shields.io/badge/search-Elasticsearch%208+-005571)](https://www.elastic.co/)

---

## Architecture Overview

```
                        ┌───────────────────────────────────────────────┐
                        │           ReachInbox React Dashboard          │
                        │       (System Monitor, Scheduler, Search)     │
                        └───────────────────────┬───────────────────────┘
                                                │ REST API / JWT
                                                ▼
                        ┌───────────────────────────────────────────────┐
                        │           Express Full-Stack API Engine       │
                        │      (OAuth, Zod Validation, Tenant Router)   │
                        └───────┬───────────────┬───────────────┬───────┘
                                │               │               │
            ┌───────────────────┴───┐   ┌───────┴──────┐   ┌───┴───────────────────┐
            ▼                       ▼   ▼              ▼   ▼                       ▼
    ┌───────────────┐       ┌───────────────┐  ┌───────────────┐       ┌───────────────┐
    │  PostgreSQL   │       │   Redis 7     │  │ Elasticsearch │       │  SMTP Server  │
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

### Key Technical Pillars

1. **Redis Lua Atomic Rate Limiting**:
   - Zero race conditions under high concurrent worker throughput.
   - Sliding-window algorithm pruning expired entries with `ZREMRANGEBYSCORE`.
   - Redis hash tag `{tenantId}` clustering support for horizontal scalability.

2. **BullMQ Distributed Scheduling Engine**:
   - Millisecond-precision delayed job execution.
   - Configurable exponential backoff retries (`attempts: 3`, `backoff: 3000ms`).
   - Dead letter queue alerting to Slack on terminal job failures.

3. **PostgreSQL & Prisma Multi-Tenant Modeling**:
   - Strict tenant isolation enforced on every query.
   - Comprehensive schemas: `Tenant`, `User`, `Campaign`, `EmailJob`, `RateLimitConfig`, `AuditLog`.
   - Verified Prisma migration history.

4. **Elasticsearch Full-Text Search**:
   - English language tokenization and analyzer mapping.
   - Filtered boolean query strictly scoped to `tenantId`.
   - Highlight tags returned for instant search UI rendering.

5. **Security & OAuth**:
   - Google OAuth 2.0 ID token cryptographic verification (`verifyIdToken`).
   - Slack OAuth state token validation against CSRF.
   - Credential masking in logs and health check outputs.

---

## Quick Start (Docker Compose)

Spin up PostgreSQL, Redis, Elasticsearch, and the Scheduler application with a single command:

```bash
docker-compose up --build
```

Access the dashboard at `http://localhost:3000`.

---

## Local Development Setup

### 1. Prerequisites
- Node.js 20+ (Node.js 22 recommended)
- PostgreSQL 15+
- Redis 7+
- Elasticsearch 8+

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/reachinbox/reachinbox-distributed-scheduler.git
cd reachinbox-distributed-scheduler

# Install dependencies
npm install --legacy-peer-deps

# Configure environment variables
cp .env.example .env
```

### 3. Database Migrations
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations
npx prisma migrate deploy
```

### 4. Run Automated Tests
```bash
npm test
```
All 38 test suites will execute and verify database schema, BullMQ queue, Redis Lua rate limiting, Elasticsearch queries, authentication, Slack alerts, and tenant isolation.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the ReachInbox dashboard.

---

## Automated Test Results

```
TAP version 13
# tests 38
# suites 9
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

1. **API Input Validation & Payload Schemas**: 3/3 passed
2. **Authentication & Security**: 4/4 passed
3. **Prisma PostgreSQL Schema & Data Modeling**: 6/6 passed
4. **Elasticsearch Indexing & Query Construction**: 4/4 passed
5. **Distributed Queue & BullMQ Scheduling**: 5/5 passed
6. **Atomic Sliding Window Rate Limiter (Redis Lua)**: 5/5 passed
7. **Slack Notifications & OAuth Validation**: 3/3 passed
8. **SMTP Email Delivery & Idempotency**: 3/3 passed
9. **Tenant Isolation & Sensitive Data Masking**: 5/5 passed

---

## Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | Web server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://...` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `ELASTICSEARCH_URL` | Elasticsearch node URL | `http://localhost:9200` |
| `SMTP_HOST` | Outgoing SMTP host | `smtp.ethereal.email` |
| `SMTP_PORT` | Outgoing SMTP port | `587` |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | - |
| `SLACK_WEBHOOK_URL`| Slack Incoming Webhook URL | - |
| `JWT_SECRET` | Secret key for signing session tokens | - |

---

## Production Verification Status

- **PostgreSQL**: Real connection verification via `SELECT 1` with health diagnostic reporting. Status: BLOCKED if unconfigured, ONLINE when connected.
- **Redis & BullMQ**: Verified Lua atomic rate limiting, queue delay calculation, worker failover, and retry backoff.
- **Elasticsearch**: Tenant-scoped boolean queries with multi-match full-text indexing and term filtering.
- **SMTP Delivery**: Tracking headers (`X-ReachInbox-Job-ID`, `X-ReachInbox-Idempotency-Key`) and response validation.
- **GitHub Readiness**: Clean repository with zero secrets in code, Docker setup, and downloadable source ZIP.

---

## License

Apache-2.0. Copyright (c) ReachInbox.
