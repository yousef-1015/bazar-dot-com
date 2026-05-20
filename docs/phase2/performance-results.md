# Phase 2 Performance Results

## Method

All tests were run through the frontend at `http://localhost:3000` with Docker Compose running all services.

Each value is the average of 20 requests using curl's `time_total`.

## Results

| Experiment | Average Response Time |
|---|---:|
| GET /info/1 with cache | 0.0002313 s |
| GET /info/1 after cache invalidation / cache miss | 0.0001891 s |
| DELETE /cache/1 invalidation request | 0.0001871 s |

## Explanation

The cached `GET /info/1` request is served directly by the frontend from memory after the first lookup.

The cache miss test deletes the cached item before each request, forcing the frontend to contact a catalog replica and repopulate the cache.

The invalidation request is lightweight because it only deletes one key from the frontend's in-memory cache.

In this local Docker environment, all times are extremely small, so the difference between cache hits and misses is also very small. On a real network or under heavier load, caching would be expected to reduce lookup latency more noticeably.