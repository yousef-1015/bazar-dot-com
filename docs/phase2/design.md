# Phase 2 Design Notes

## Frontend Round-Robin Load Balancing

The frontend performs per-request round-robin load balancing across catalog and order replicas.

For catalog requests, the frontend stores a list of catalog replica URLs. Each request uses `getNextCatalog()`, which returns the current replica and advances the index for the next request.

For order requests, the frontend uses the same pattern with `getNextOrder()`.

This means requests alternate between replicas:

```text
catalog -> catalog-replica -> catalog -> catalog-replica
order -> order-replica -> order -> order-replica
```

## Frontend Cache

The frontend has an in-memory cache implemented as a JavaScript object.

Only `GET /info/:id` is cached. This endpoint returns book lookup data, so it is safe to reuse until the book changes.

`GET /search/:topic` is not cached in this implementation. `POST /purchase/:id` is also not cached because it is a write request.

## Cache Hit And Miss Behavior

When the frontend receives `GET /info/:id`, it first checks the cache.

If the book exists in the cache, the frontend returns it immediately and logs a cache hit.

If the book is not in the cache, the frontend forwards the request to a catalog replica, stores successful responses, and logs a cache miss.

Failed catalog responses are not cached.

## Server-Push Cache Invalidation

Catalog servers invalidate the frontend cache before writing catalog updates.

When a catalog server updates a book, it sends:

```http
DELETE /cache/:id
```

to the frontend. The frontend deletes only that book id from the cache.

This prevents stale book data from remaining in the cache after purchases or catalog updates.

## Docker Service Hostnames

Docker Compose runs all services on one Docker network.

Inside Docker, services communicate using service names instead of localhost:

```text
frontend:3000
catalog:3001
catalog-replica:3003
order:3002
order-replica:3004
```

The frontend reads replica lists from:

```text
CATALOG_REPLICAS
ORDER_REPLICAS
```

Backend services read replica URLs from environment variables such as:

```text
REPLICA_URL
FRONTEND_URL
CATALOG_URL
```

## Tradeoffs

Round-robin load balancing is simple and predictable, but it does not check server health or current load.

The in-memory cache is very fast and easy to implement, but it is lost when the frontend restarts. This is acceptable for the lab because the frontend is not replicated.

The cache has no size limit. This is fine for the small catalog, but a larger system would need a cache replacement policy.

## How To Run

Start all services:

```bash
docker compose up --build
```

Stop all services:

```bash
docker compose down
```

## Test Commands

Test catalog load balancing:

```bash
curl 'http://localhost:3000/search/distributed%20systems'
curl 'http://localhost:3000/search/distributed%20systems'
```

Test cache hit and miss:

```bash
curl http://localhost:3000/info/1
curl http://localhost:3000/info/1
```

Test cache invalidation:

```bash
curl -X DELETE http://localhost:3000/cache/1
curl http://localhost:3000/info/1
```

Test order load balancing:

```bash
curl -X POST http://localhost:3000/purchase/1
curl -X POST http://localhost:3000/purchase/1
```
