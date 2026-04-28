// server.js

import express from "express";
import cors from "cors";
import tasksRoutes from "./routes/tasks.js";
import rateLimitMiddleware from "./middleware/rateLimit.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(rateLimitMiddleware);

// rutas
app.use("/api/tasks", tasksRoutes);

app.listen(3000, () => {
  console.log("Secure API running on port 3000");
});
