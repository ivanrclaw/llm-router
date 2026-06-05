import { DataSource } from "typeorm";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: path.join(__dirname, "..", "data", "llm-router.sqlite"),
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV !== "production",
  entities: [path.join(__dirname, "entities", "*.{ts,js}")],
  migrations: [path.join(__dirname, "migrations", "*.{ts,js}")],
});
