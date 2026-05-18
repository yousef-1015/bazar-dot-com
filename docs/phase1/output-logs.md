# Phase 1 Output Logs

## Run Command

The system was started using Docker Compose from the project root:

```bash
docker compose up --build
```

The frontend service runs on port `3000`, catalog runs on port `3001`, and order runs on port `3002`.

## Search Request

Command:

```bash
curl -s http://localhost:3000/search/distributed%20systems | jq
```

Output:

```json
[
  {
    "id": 1,
    "title": "How to get a good grade in DOS in 40 minutes a day"
  },
  {
    "id": 2,
    "title": "RPCs for Noobs"
  }
]
```

## Info Request Before Purchase

Command:

```bash
curl -s http://localhost:3000/info/2 | jq
```

Output:

```json
{
  "id": 2,
  "title": "RPCs for Noobs",
  "topic": "distributed systems",
  "price": 50,
  "quantity": 7
}
```

## Purchase Request

Command:

```bash
curl -s -X POST http://localhost:3000/purchase/2 | jq
```

Output:

```json
{
  "message": "Order placed successfully",
  "book": "RPCs for Noobs"
}
```

Order service log:

```text
[ORDER] bought book RPCs for Noobs
```

## Info Request After Purchase

Command:

```bash
curl -s http://localhost:3000/info/2 | jq
```

Output:

```json
{
  "id": 2,
  "title": "RPCs for Noobs",
  "topic": "distributed systems",
  "price": 50,
  "quantity": 6
}
```

This confirms that the purchase request decremented the catalog quantity from `7` to `6`.

## Shutdown

Command:

```bash
docker compose down
```
