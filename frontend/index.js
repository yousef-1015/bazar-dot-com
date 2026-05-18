import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[frontend] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.json({
    message: "Bazar.com frontend server is running"
  });
});

app.listen(PORT, () => {
  console.log(`[frontend] server running on port ${PORT}`);
});