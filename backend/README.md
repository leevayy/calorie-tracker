# Backend

Fastify + TypeScript backend for the calorie tracker contracts.

## Stack

- Fastify (REST API)
- Zod (request/response validation from shared `contracts/`)
- Drizzle ORM + PostgreSQL (`pg`)
- Node runtime with `--experimental-strip-types` in production
- `tsx` in development
- Yandex AI Studio (DeepSeek 3.2) for AI routes

## Local run with Docker

1. Copy env template:

```bash
cp backend/.env.example backend/.env
```

2. Update `backend/.env` values (at least `JWT_SECRET`, optional `YANDEX_AI_STUDIO_API_KEY`).

3. Start services:

```bash
docker compose up --build
```

4. API and docs:
- API: `http://localhost:3000`
- Health: `GET /health`
- OpenAPI UI: `http://localhost:3000/docs`

## Scripts

- `npm run dev` - `tsx` watch server
- `npm run start` - production-style node runtime with type stripping
- `npm run db:migrate` - SQL migration bootstrap
- `npm run check` - TypeScript check (`tsc --noEmit`)

## Security and rate limits

- JWT Bearer auth on protected routes.
- IP-based in-memory rate limiting for:
  - `/auth/*`
  - `/ai/*`
- Default policy: over 10 requests/minute triggers `429` with `Retry-After`, then 15-minute cooldown.

## Deployment notes (single VPS)

- Uses Docker Compose with:
  - `api` service
  - `db` service (PostgreSQL)
- Secrets are env-only (`backend/.env`), not committed.
- No Yandex Managed PostgreSQL and no Yandex Lockbox in v1.
