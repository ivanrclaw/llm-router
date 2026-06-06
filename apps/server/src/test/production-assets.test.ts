import { mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import Database from "better-sqlite3";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../../");
const execFileAsync = promisify(execFile);
const requiredFiles = [
  "Dockerfile",
  "fly.toml",
  ".github/workflows/ci.yml",
  ".github/workflows/deploy.yml",
  ".env.example",
  "docs/production-deployment.md",
  "apps/server/src/scripts/backup-sqlite.ts",
];

let tmpDirs: string[] = [];

describe("production deployment assets", () => {
  afterEach(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tmpDirs = [];
  });

  it("keeps required Docker, Fly, CI, env, docs, and backup assets versioned", async () => {
    for (const relativePath of requiredFiles) {
      await expect(import("node:fs/promises").then((fs) => fs.access(path.join(repoRoot, relativePath)))).resolves.toBeUndefined();
    }
  });

  it("documents production env vars, persistent SQLite volume, migrations, backup, and restore", async () => {
    const [envExample, flyToml, docs] = await Promise.all([
      import("node:fs/promises").then((fs) => fs.readFile(path.join(repoRoot, ".env.example"), "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile(path.join(repoRoot, "fly.toml"), "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile(path.join(repoRoot, "docs/production-deployment.md"), "utf8")),
    ]);

    expect(envExample).toContain("DATABASE_PATH=/data/llm-router.sqlite");
    expect(envExample).toContain("JWT_SECRET=");
    expect(envExample).toContain("ENCRYPTION_KEY=");
    expect(envExample).toContain("RUN_MIGRATIONS=true");
    expect(envExample).toContain("SERVE_WEB_DIST=true");
    expect(envExample).not.toContain("sk-");
    expect(flyToml).toContain("source = \"llm_router_data\"");
    expect(flyToml).toContain("destination = \"/data\"");
    expect(flyToml).toContain("auto_stop_machines = \"stop\"");
    expect(flyToml).toContain("auto_start_machines = true");
    expect(flyToml).toContain("min_machines_running = 0");
    expect(flyToml).toContain("/api/ready");
    expect(docs).toContain("fly volumes create llm_router_data");
    expect(docs).toContain("pnpm --filter @llm-router/server backup:sqlite");
    expect(docs).toContain("restore");
  });

  it("defines CI and Fly deploy workflows with install, type-check, test, build, and flyctl deployment", async () => {
    const [ci, deploy] = await Promise.all([
      import("node:fs/promises").then((fs) => fs.readFile(path.join(repoRoot, ".github/workflows/ci.yml"), "utf8")),
      import("node:fs/promises").then((fs) => fs.readFile(path.join(repoRoot, ".github/workflows/deploy.yml"), "utf8")),
    ]);

    expect(ci).toContain("pnpm install --frozen-lockfile");
    expect(ci).toContain("pnpm type-check");
    expect(ci).toContain("pnpm test:run");
    expect(ci).toContain("pnpm build");
    expect(deploy).toContain("superfly/flyctl-actions/setup-flyctl");
    expect(deploy).toContain("flyctl deploy --remote-only");
    expect(deploy).toContain("FLY_API_TOKEN");
  });

  it("backup script creates a restorable SQLite copy with WAL checkpoint semantics", async () => {
    const script = await import("node:fs/promises").then((fs) =>
      fs.readFile(path.join(repoRoot, "apps/server/src/scripts/backup-sqlite.ts"), "utf8"),
    );

    expect(script).toContain("wal_checkpoint(TRUNCATE)");
    expect(script).toContain("sqlite_version()");

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "llm-router-backup-test-"));
    tmpDirs.push(tmpDir);
    const dbPath = path.join(tmpDir, "llm-router.sqlite");
    const backupDir = path.join(tmpDir, "backups");
    const db = new Database(dbPath);
    db.exec("CREATE TABLE smoke (id INTEGER PRIMARY KEY, label TEXT); INSERT INTO smoke (label) VALUES ('restorable');");
    db.close();

    const result = await execFileAsync(
      "pnpm",
      ["--filter", "@llm-router/server", "exec", "tsx", "src/scripts/backup-sqlite.ts"],
      {
        cwd: repoRoot,
        env: { ...process.env, DATABASE_PATH: dbPath, BACKUP_DIR: backupDir },
      },
    );

    expect(result.stdout).toContain("BACKUP_OK");
  });
});
