import "reflect-metadata";
import { AppDataSource } from "./data-source.js";
import { createApp } from "./app.js";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3001;

function shouldRunMigrations(): boolean {
  return process.env.RUN_MIGRATIONS !== "false";
}

async function main() {
  try {
    await AppDataSource.initialize();
    console.log("✓ Database connected");

    if (shouldRunMigrations()) {
      const migrations = await AppDataSource.runMigrations();
      console.log(`✓ Database migrations complete (${migrations.length} applied)`);
    }

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
