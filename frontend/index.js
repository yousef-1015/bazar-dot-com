import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const catalogReplicas = (
  process.env.CATALOG_REPLICAS || "http://localhost:3001,http://localhost:3003"
).split(",");

const orderReplicas = (
  process.env.ORDER_REPLICAS || "http://localhost:3002,http://localhost:3004"
).split(",");
const cache = {};

let catalogIndex = 0;
let orderIndex = 0;

function getNextCatalog() {
  const url = catalogReplicas[catalogIndex];
  catalogIndex = (catalogIndex + 1) % catalogReplicas.length;
  return url;
}

function getNextOrder() {
  const url = orderReplicas[orderIndex];
  orderIndex = (orderIndex + 1) % orderReplicas.length;
  return url;
}

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[frontend] ${req.method} ${req.url}`);
  next();
});

app.get("/search/:topic", async (req, res) => {
  try {
    const catalogUrl = getNextCatalog();
    console.log(`[FRONTEND] ROUTE GET /search/${req.params.topic} -> ${catalogUrl}`);

    const response = await fetch(
      `${catalogUrl}/search/${encodeURIComponent(req.params.topic)}`
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Frontend failed to contact catalog server"
    });
  }
});


app.get("/info/:id", async (req, res) => {
  const id = req.params.id;

  if (cache[id]) {
    console.log(`[FRONTEND] CACHE HIT id=${id}`);
    return res.json(cache[id]);
  }

  try {
    console.log(`[FRONTEND] CACHE MISS id=${id}`);

    const catalogUrl = getNextCatalog();
    console.log(`[FRONTEND] ROUTE GET /info/${id} -> ${catalogUrl}`);

    const response = await fetch(`${catalogUrl}/info/${id}`);
    const data = await response.json();

    if (response.ok) {
      cache[id] = data;
    }

    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Frontend failed to contact catalog server"
    });
  }
});


app.delete("/cache/:id", (req, res) => {
  const id = req.params.id;

  delete cache[id];

  console.log(`[FRONTEND] CACHE INVALIDATED id=${id}`);

  res.json({
    message: "Cache invalidated"
  });
});

app.post("/purchase/:id", async (req, res) => {
  try {
  const orderUrl = getNextOrder();
  console.log(`[FRONTEND] ROUTE POST /purchase/${req.params.id} -> ${orderUrl}`);

  const response = await fetch(`${orderUrl}/purchase/${req.params.id}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    }
  });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Frontend failed to contact order server"
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Bazar.com frontend server is running"
  });
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found"
  });
});

app.listen(PORT, () => {
  console.log(`[frontend] server running on port ${PORT}`);
});