import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "./test-db.js";

let tmpDirs: string[] = [];

async function createWebDist(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "llm-router-web-dist-"));
  tmpDirs.push(dir);
  await writeFile(path.join(dir, "index.html"), "<!doctype html><html><body><div id=\"root\">LLM Router Dashboard</div></body></html>");
  return dir;
}

describe("production readiness", () => {
  beforeEach(() => {
    delete process.env.SERVE_WEB_DIST;
    delete process.env.WEB_DIST_PATH;
    delete process.env.NODE_ENV;
  });

  afterEach(async () => {
    await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tmpDirs = [];
    delete process.env.SERVE_WEB_DIST;
    delete process.env.WEB_DIST_PATH;
  });

  it("reports readiness after migrations have run against the configured data source", async () => {
    const dataSource = await createMigratedTestDataSource("readiness-check");
    try {
      const app = createApp({ dataSource });

      const response = await request(app).get("/api/ready").expect(200);

      expect(response.body).toMatchObject({
        status: "ready",
        service: "llm-router",
        database: { connected: true, migrationsPending: false },
      });
    } finally {
      await dataSource.destroy();
    }
  });

  it("returns service unavailable when readiness cannot confirm database connectivity", async () => {
    const app = createApp({
      dataSource: {
        isInitialized: false,
      } as never,
    });

    const response = await request(app).get("/api/ready").expect(503);

    expect(response.body).toMatchObject({
      status: "not_ready",
      service: "llm-router",
      database: { connected: false },
    });
  });

  it("serves the built web dashboard in production mode without swallowing API 404s", async () => {
    process.env.SERVE_WEB_DIST = "true";
    process.env.WEB_DIST_PATH = await createWebDist();

    const app = createApp();
    const response = await request(app).get("/dashboard").expect(200);
    await request(app).get("/api/missing-route").expect(404);

    expect(response.text).toContain("LLM Router Dashboard");
  });
});
