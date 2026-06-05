import { DataSource } from "typeorm";
import path from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { InitialSchema1780689600000 } from "../migrations/1780689600000-InitialSchema.js";

function createDatabasePath(name: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `${name}-`));
  return path.join(dir, "test.sqlite");
}

export function createTestDataSource(name = "llm-router-test"): DataSource {
  return new DataSource({
    type: "better-sqlite3",
    database: createDatabasePath(name),
    synchronize: true,
    logging: false,
    entities: [],
    migrations: [],
  });
}

export async function createMigratedTestDataSource(name = "llm-router-migrated-test"): Promise<DataSource> {
  const dataSource = new DataSource({
    type: "better-sqlite3",
    database: createDatabasePath(name),
    synchronize: false,
    logging: false,
    entities: [],
    migrations: [InitialSchema1780689600000],
  });

  await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
}
