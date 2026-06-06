import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function main(): Promise<void> {
  const databasePath = process.env.DATABASE_PATH ?? path.resolve(process.cwd(), "data", "llm-router.sqlite");
  const backupDir = process.env.BACKUP_DIR ?? path.dirname(databasePath);

  const dbStats = await stat(databasePath).catch(() => null);
  if (!dbStats?.isFile()) {
    throw new Error(`SQLite database not found at ${databasePath}`);
  }

  await mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `llm-router-${timestampForFilename()}.sqlite`);

  const db = new Database(databasePath, { readonly: false });
  try {
    db.pragma("wal_checkpoint(TRUNCATE)");
    const versionRows = db.prepare("SELECT sqlite_version() AS version").all() as Array<{ version: string }>;
    const sqliteVersion = versionRows[0]?.version ?? "unknown";
    await db.backup(backupPath);
    console.log(`BACKUP_OK ${JSON.stringify({ databasePath, backupPath, sqliteVersion })}`);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(`BACKUP_FAILED ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
