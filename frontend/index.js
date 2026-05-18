import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const CATALOG_URL = process.env.CATALOG_URL || "http://localhost:3001";
const ORDER_URL = process.env.ORDER_URL || "http://localhost:3002";

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[frontend] ${req.method} ${req.url}`);
  next();
});

app.get("/search/:topic", async (req, res) => {
  try {
    const response = await fetch(
      `${CATALOG_URL}/search/${encodeURIComponent(req.params.topic)}`
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({
      error: "Frontend failed to contact catalog server"
    });
  }
});


app.post("/purchase/:id", async (req, res) => {
  try {
    const response = await fetch(`${ORDER_URL}/purchase/${req.params.id}`, {
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

app.listen(PORT, () => {
  console.log(`[frontend] server running on port ${PORT}`);
});