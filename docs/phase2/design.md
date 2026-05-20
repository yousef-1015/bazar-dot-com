# Phase 2 Design Document

## Overall System Design

Bazar.com is implemented as a small microservice system. The client sends all requests to the frontend service. The frontend does not store book or order data permanently; instead, it routes client requests to backend services.

Phase 1 had three services:

| Service | Port | Responsibility |
|---|---:|---|
| Frontend | 3000 | Public API used by clients. Forwards requests to backend services. |
| Catalog | 3001 | Stores book data in `catalog-data.csv`; supports search, info, and update. |
| Order | 3002 | Handles purchases; checks stock, updates catalog, and appends orders to CSV. |

Phase 2 adds replication, caching, and consistency support:

| Service | Port | Docker service name | Responsibility |
|---|---:|---|---|
| Frontend | 3000 | `frontend` | Public API, load balancer, and in-memory cache. |
| Catalog replica 1 | 3001 | `catalog` | Catalog reads/writes and syncs updates to replica 2. |
| Catalog replica 2 | 3003 | `catalog-replica` | Same catalog API, syncs updates to replica 1. |
| Order replica 1 | 3002 | `order` | Purchase handling and order sync to replica 2. |
| Order replica 2 | 3004 | `order-replica` | Same order API, syncs orders to replica 1. |

All services communicate using REST APIs. Docker Compose places the services on one internal network, so containers use service names such as `http://catalog:3001` instead of `localhost`.

## Main API Endpoints

Frontend endpoints used by clients:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/search/:topic` | Search books by topic. Forwarded to a catalog replica. |
| `GET` | `/info/:id` | Get one book's details. Uses frontend cache first. |
| `POST` | `/purchase/:id` | Purchase one book. Forwarded to an order replica. |
| `DELETE` | `/cache/:id` | Invalidates one cached book entry. Called by catalog replicas. |

Catalog endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/search/:topic` | Reads catalog CSV and returns matching books. |
| `GET` | `/info/:id` | Returns one book's title, topic, price, and quantity. |
| `PUT` | `/update/:id` | Updates quantity or price, invalidates cache, then syncs replica. |
| `POST` | `/sync` | Receives a mirrored catalog update from the other replica. |

Order endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/purchase/:id` | Checks stock, updates catalog, writes order row, syncs replica. |
| `POST` | `/sync` | Receives a mirrored order row from the other replica. |

## Request Flows

### Search Flow

1. Client sends `GET /search/:topic` to the frontend.
2. Frontend chooses a catalog replica using round-robin.
3. Catalog reads `catalog-data.csv`.
4. Catalog returns matching books.
5. Frontend returns the JSON response to the client.

Search results are not cached in this implementation.

### Info Flow With Cache

1. Client sends `GET /info/:id` to the frontend.
2. Frontend checks its in-memory cache object.
3. If `cache[id]` exists, frontend returns it immediately and logs `CACHE HIT`.
4. If `cache[id]` does not exist, frontend logs `CACHE MISS`.
5. Frontend chooses a catalog replica using round-robin.
6. Catalog returns the book data.
7. Frontend stores successful responses in `cache[id]`.
8. Frontend returns the JSON response to the client.

Only successful catalog responses are cached. Failed responses, such as book-not-found errors, are not cached.

### Purchase Flow

1. Client sends `POST /purchase/:id` to the frontend.
2. Frontend chooses an order replica using round-robin.
3. Order replica calls catalog `GET /info/:id` to check whether the book exists and is in stock.
4. If quantity is 0, order returns an out-of-stock error.
5. If quantity is available, order calls catalog `PUT /update/:id` with `{ "field": "quantity", "value": -1 }`.
6. Catalog invalidates frontend cache for that book before writing the CSV update.
7. Catalog writes the new quantity to its local CSV.
8. Catalog sends `POST /sync` to the other catalog replica.
9. Order writes a new order row to its local order CSV.
10. Order sends `POST /sync` to the other order replica.
11. Order returns success to the frontend, and frontend returns success to the client.

## Load Balancing

The frontend uses per-request round-robin load balancing.

For catalog requests, the frontend stores this replica list:

```text
http://catalog:3001
http://catalog-replica:3003
```

For order requests, the frontend stores this replica list:

```text
http://order:3002
http://order-replica:3004
```

Each request calls either `getNextCatalog()` or `getNextOrder()`. The helper returns the current replica URL, then advances the index using modulo arithmetic. This causes requests to alternate between replicas:

```text
catalog -> catalog-replica -> catalog -> catalog-replica
order -> order-replica -> order -> order-replica
```

Important detail: `GET /info/:id` only uses load balancing on cache misses. If the request is a cache hit, the frontend answers directly from memory and does not contact a catalog replica.

## Frontend Cache

The frontend cache is an in-memory JavaScript object:

```js
const cache = {};
```

Only `GET /info/:id` is cached. This endpoint is a read-only lookup for one book, so it is safe and useful to cache.

The following requests are not cached:

- `GET /search/:topic`, to keep the cache simple and focused on repeated book lookups.
- `POST /purchase/:id`, because purchase is a write operation that changes stock and creates an order.
- Error responses, because the frontend only caches when the catalog response is successful.

## Cache Consistency And Invalidation

The system uses server-push cache invalidation.

When a catalog replica updates a book, it first sends this request to the frontend:

```http
DELETE /cache/:id
```

The frontend deletes only that book id from the cache:

```js
delete cache[id];
```

This happens before the catalog writes to its CSV file. The goal is to avoid stale cached data after a purchase or catalog update.

Example:

1. Client calls `GET /info/1`, and the frontend caches book 1.
2. Client purchases book 1.
3. Catalog receives the quantity update.
4. Catalog calls `DELETE /cache/1` on the frontend.
5. Frontend removes `cache[1]`.
6. The next `GET /info/1` is a cache miss and fetches fresh data from catalog.

## Replica Consistency

Catalog replicas and order replicas use internal `POST /sync` endpoints.

For catalog:

1. A replica receives `PUT /update/:id`.
2. It invalidates the frontend cache.
3. It writes the local CSV update.
4. It sends `{ id, field, value }` to the other replica's `POST /sync`.
5. The receiving replica applies the update locally.
6. The receiving replica does not sync back, which avoids an infinite loop.

For order:

1. A replica completes a purchase.
2. It appends the order row locally.
3. It sends `{ orderId, bookId, bookTitle, timestamp }` to the other order replica's `POST /sync`.
4. The receiving order replica appends the same row locally.
5. The receiving replica does not sync back.

This provides simple eventual consistency between the CSV files used by replicas.

## Docker Design

Docker Compose runs all five services on one Docker network named `bazar-network`.

Important Docker environment variables:

| Service | Variable | Value |
|---|---|---|
| Frontend | `CATALOG_REPLICAS` | `http://catalog:3001,http://catalog-replica:3003` |
| Frontend | `ORDER_REPLICAS` | `http://order:3002,http://order-replica:3004` |
| Catalog | `REPLICA_URL` | `http://catalog-replica:3003` |
| Catalog | `FRONTEND_URL` | `http://frontend:3000` |
| Catalog replica | `REPLICA_URL` | `http://catalog:3001` |
| Catalog replica | `FRONTEND_URL` | `http://frontend:3000` |
| Order | `CATALOG_URL` | `http://catalog:3001` |
| Order | `REPLICA_URL` | `http://order-replica:3004` |
| Order replica | `CATALOG_URL` | `http://catalog:3001` |
| Order replica | `REPLICA_URL` | `http://order:3002` |

CSV files are mounted as Docker volumes so data changes persist on the host:

```text
catalog/catalog-data.csv
catalog-replica/catalog-data.csv
order/orders-data.csv
order-replica/order-data.csv
```

## Performance Measurements

Performance measurements were collected using `curl` and its `time_total` output. Each experiment used 20 requests through the frontend at `http://localhost:3000`.

Measured cases:

| Experiment | What it measures |
|---|---|
| Cached `GET /info/1` | Frontend returns book info directly from memory. |
| `GET /info/1` after invalidation | Frontend cache miss; request goes to catalog replica. |
| `DELETE /cache/1` | Cache invalidation overhead. |

The results are documented in `docs/phase2/performance-results.md`. In the local Docker environment, response times were extremely small, so the performance difference between cache hits and misses was also small. In a real distributed deployment, caching would be expected to reduce lookup latency more clearly.

## Design Tradeoffs

Round-robin load balancing is simple and predictable, but it does not consider server health or current load. If one replica is down, the current implementation may still route requests to it.

The frontend in-memory cache is fast and simple, but it is lost when the frontend restarts. It also works because the frontend is not replicated. If there were multiple frontend replicas, a shared cache or invalidation broadcast would be needed.

CSV storage is easy for the lab and makes the data visible, but it is not ideal for concurrent writes, transactions, or large datasets. A production system would use a database.

The replica sync protocol is intentionally simple. It avoids infinite loops by making `POST /sync` apply the update locally without syncing back. However, it does not handle network failures with retries or conflict resolution.

## Possible Improvements

Possible improvements include:

- Add health checks and skip unhealthy replicas.
- Retry another replica when one request fails.
- Add an LRU cache size limit.
- Move from CSV files to a real database.
- Add locking or transactions for concurrent purchases.
- Add stronger failure handling for replica sync.
- Add more detailed performance tests under higher load.

## Known Limitations

The system assumes replicas are available when sync requests are sent. If a replica is down, the sender logs a warning, but there is no retry queue.

Concurrent purchases can still be risky because CSV writes are not transactional.

The cache is stored only in frontend memory, so it is cleared when the frontend restarts.

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
curl -X DELETE http://localhost:3000/cache/1
curl http://localhost:3000/info/1
curl http://localhost:3000/info/1
```

Test cache invalidation after purchase:

```bash
curl -X DELETE http://localhost:3000/cache/1
curl http://localhost:3000/info/1
curl -X POST http://localhost:3000/purchase/1
curl http://localhost:3000/info/1
```

Test order load balancing:

```bash
curl -X POST http://localhost:3000/purchase/1
curl -X POST http://localhost:3000/purchase/1
```

Test catalog replica sync directly:

```bash
curl -X PUT http://localhost:3001/update/1 \
  -H 'Content-Type: application/json' \
  -d '{"field":"price","value":41}'

curl http://localhost:3001/info/1
curl http://localhost:3003/info/1
```
