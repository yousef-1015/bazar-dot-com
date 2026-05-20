# Phase 2 Output Logs

## Frontend Load Balancing - Catalog Replicas

```text
bazar-frontend | [FRONTEND] ROUTE GET /info/1 -> http://catalog:3001
bazar-frontend | [FRONTEND] ROUTE GET /info/1 -> http://catalog-replica:3003
```

```text
bazar-frontend | [FRONTEND] ROUTE GET /search/distributed systems -> http://catalog-replica:3003
bazar-frontend | [FRONTEND] ROUTE GET /search/distributed systems -> http://catalog:3001
```

## Frontend Load Balancing - Order Replicas

```text
bazar-frontend | [FRONTEND] ROUTE POST /purchase/1 -> http://order:3002
bazar-frontend | [FRONTEND] ROUTE POST /purchase/1 -> http://order-replica:3004
```

## Frontend Cache Miss

```text
bazar-frontend | [frontend] GET /info/1
bazar-frontend | [FRONTEND] CACHE MISS id=1
bazar-frontend | [FRONTEND] ROUTE GET /info/1 -> http://catalog:3001
```

## Frontend Cache Hit

```text
bazar-frontend | [frontend] GET /info/1
bazar-frontend | [FRONTEND] CACHE HIT id=1
```

## Cache Invalidation

```text
bazar-frontend | [frontend] DELETE /cache/1
bazar-frontend | [FRONTEND] CACHE INVALIDATED id=1
bazar-catalog  | [CATALOG] CACHE INVALIDATE sent for id=1
```

## Catalog Replica Sync

```text
bazar-catalog          | [CATALOG] SYNC sent to replica for id=1
bazar-catalog-replica  | [CATALOG-R2] SYNC received — id=1 field=quantity value=-1
```

## Order Replica Sync

```text
bazar-order          | [ORDER] SYNC sent to replica — order <orderId>
bazar-order-replica  | [ORDER] SYNC received — order <orderId>
```

## Cache Miss After Invalidation

```text
bazar-frontend | [frontend] GET /info/1
bazar-frontend | [FRONTEND] CACHE MISS id=1
bazar-frontend | [FRONTEND] ROUTE GET /info/1 -> http://catalog-replica:3003
```