# Bazar.com Phase 1 Design Document

## Overall Design

Bazar.com is implemented as a small multi-tier online bookstore using three separate HTTP REST microservices. The system has one frontend service and two backend services: a catalog service and an order service. Each service runs as its own Node.js and Express application and is packaged into its own Docker container.

The frontend service is the entry point for clients. A user, browser, or command-line client sends requests to the frontend on port `3000`. The frontend does not store bookstore data itself. Instead, it forwards catalog-related requests to the catalog service and purchase requests to the order service.

The catalog service runs on port `3001`. It maintains information about the available books, including each book's id, title, topic, price, and quantity. The catalog data is stored persistently in a CSV file.

The order service runs on port `3002`. It handles purchases. Before completing a purchase, it contacts the catalog service to check whether the requested book exists and has available stock. If the book is available, the order service asks the catalog service to decrement the quantity, then records the purchase in an orders CSV file.

Docker Compose is used to run all services together on one internal Docker network. Inside Docker, services communicate using their Compose service names, such as `http://catalog:3001` and `http://order:3002`.

## Services and Ports

| Service | Port | Responsibility |
|---|---:|---|
| Frontend | 3000 | Receives client requests and forwards them to backend services |
| Catalog | 3001 | Stores book information and supports search, info, and update operations |
| Order | 3002 | Handles purchases and records successful orders |

## REST API

### Frontend API

The frontend exposes the client-facing API:

```text
GET  /search/:topic
GET  /info/:id
POST /purchase/:id
```

`GET /search/:topic` forwards the request to the catalog service and returns all books matching the given topic.

`GET /info/:id` forwards the request to the catalog service and returns details for one book.

`POST /purchase/:id` forwards the request to the order service and returns whether the purchase succeeded or failed.

All frontend responses are returned as JSON, including error responses.

### Catalog API

The catalog service exposes:

```text
GET /search/:topic
GET /info/:id
PUT /update/:id
```

`GET /search/:topic` returns matching books by topic.

`GET /info/:id` returns the full details for one book.

`PUT /update/:id` updates either the quantity or price of a book. The order service uses this endpoint to decrement stock after a successful purchase.

### Order API

The order service exposes:

```text
POST /purchase/:id
```

When a purchase request arrives, the order service performs the following steps:

1. Calls the catalog service using `GET /info/:id`.
2. Checks whether the book exists.
3. Checks whether the quantity is greater than zero.
4. Calls the catalog service using `PUT /update/:id` to decrement the quantity.
5. Appends the order to the orders CSV file.
6. Prints a log message in the format `bought book book_name`.
7. Returns a JSON success response to the client.

## Request Flow

For a search request, the flow is:

```text
client -> frontend -> catalog -> frontend -> client
```

For an info request, the flow is:

```text
client -> frontend -> catalog -> frontend -> client
```

For a purchase request, the flow is:

```text
client -> frontend -> order -> catalog
                         order -> catalog update
                         order -> orders CSV
client <- frontend <- order
```

This keeps the frontend simple. It only routes requests and returns JSON responses. The catalog service owns book data, and the order service owns purchase logic.

## Persistent Storage

The project uses CSV files instead of a database.

The catalog service stores book data in:

```text
catalog/catalog-data.csv
```

The order service stores completed purchases in:

```text
order/orders-data.csv
```

Docker Compose mounts these CSV files into the containers as volumes so that updates persist even after containers stop.

## Known Limitations

The system uses CSV files, so it is not ideal for heavy concurrent writes. If many purchase requests happen at exactly the same time, there is a possible race condition where stock could be updated incorrectly.

The order service depends on the catalog service being available. If the catalog service is down, purchases fail.

Error handling is basic. The services return JSON errors, but the system does not include advanced retry logic or detailed failure recovery.

## How To Run

Install Docker and Docker Compose, then run the following from the project root:

```bash
docker compose up --build
```

The services will be available at:

```text
Frontend: http://localhost:3000
Catalog:  http://localhost:3001
Order:    http://localhost:3002
```

Test search through the frontend:

```bash
curl -s http://localhost:3000/search/distributed%20systems | jq
```

Test book info through the frontend:

```bash
curl -s http://localhost:3000/info/2 | jq
```

Test purchase through the frontend:

```bash
curl -s -X POST http://localhost:3000/purchase/2 | jq
```

Check that the quantity decreased:

```bash
curl -s http://localhost:3000/info/2 | jq
```

Stop the system:

```bash
docker compose down
```
