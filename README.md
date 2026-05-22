# Distributed Bookstore Microservices

This is a distributed bookstore lab project built with Node.js, Express, REST APIs, CSV-backed storage, and Docker Compose.

The system includes a frontend service, replicated catalog services, and replicated order services. Phase 2 adds round-robin load balancing, an in-memory frontend cache, server-push cache invalidation, and replica synchronization.

## Services

| Service | Port | Description |
|---|---:|---|
| Frontend | 3000 | Public API, load balancing, and cache |
| Catalog | 3001 | Catalog replica 1 |
| Catalog replica | 3003 | Catalog replica 2 |
| Order | 3002 | Order replica 1 |
| Order replica | 3004 | Order replica 2 |

## Run

```bash
docker compose up --build
```

Stop:

```bash
docker compose down
```

## Main Endpoints

```http
GET    /search/:topic
GET    /info/:id
POST   /purchase/:id
DELETE /cache/:id
```

Examples:

```bash
curl 'http://localhost:3000/search/distributed%20systems'
curl http://localhost:3000/info/1
curl -X POST http://localhost:3000/purchase/1
```

## Phase 2 Features

- Per-request round-robin load balancing across catalog and order replicas.
- In-memory frontend cache for `GET /info/:id`.
- Server-push cache invalidation using `DELETE /cache/:id`.
- Catalog replica sync using `POST /sync`.
- Order replica sync using `POST /sync`.
- Docker Compose networking with service hostnames.

## Performance Measurement

```bash
node scripts/measure-performance.js
```

## Docs

- `docs/phase1/design.md`
- `docs/phase1/output-logs.md`
- `docs/phase2/design.md`
- `docs/phase2/output-logs.md`
- `docs/phase2/performance-results.md`
