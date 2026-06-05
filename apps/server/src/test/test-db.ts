import { DataSource } from "typeorm";
import path from "path";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";

export function createTestDataSource(name = "llm-router-test"): DataSource {
  const dir = mkdtempSync(path.join(tmpdir(), `${name}-`));

  return new DataSource({
    type: "better-sqlite3",
    database: path.join(dir, "test.sqlite"),
    synchronize: true,
    logging: false,
    entities: [],
    migrations: [],
  });
}
