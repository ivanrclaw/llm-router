import "reflect-metadata";
import express from "express";
import cors from "cors";
import { AppDataSource } from "./data-source.js";
import { healthRouter } from "./routes/health.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use("/api", healthRouter);

// Start server
async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✓ Database connected");

    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
