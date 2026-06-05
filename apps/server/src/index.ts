import "reflect-metadata";
import { AppDataSource } from "./data-source.js";
import { createApp } from "./app.js";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✓ Database connected");

    const app = createApp();
    app.listen(PORT, () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

void main();
