import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedDefaultModelGroups, seedOpenCodeZenModels } from "../seeds/index.js";

async function createAuthenticatedServer() {
  const dataSource = await createMigratedTestDataSource("platform-api-keys-test");
  await seedOpenCodeZenModels(dataSource);
  await seedDefaultModelGroups(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email: "apikey-owner@example.com",
    name: "API Key Owner",
    password: "secure-password-123",
    teamName: "API Key Team",
  });
  return { dataSource, app, token: register.body.token as string, teamId: register.body.teams[0].id as string };
}

describe("platform API keys", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("creates lr_ keys, stores only hash/prefix, lists without full key, and authenticates /v1/models", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({
        name: "CI Key",
        scopes: ["models:read", "chat:write"],
        dailyBudgetUsdCents: 250,
        monthlyBudgetUsdCents: 5000,
        rateLimitRpm: 60,
      });

    expect(created.status).toBe(201);
    expect(created.body.apiKey.key).toMatch(/^lr_[A-Za-z0-9_-]{32,}$/);
    expect(created.body.apiKey.keyPrefix).toBe(created.body.apiKey.key.slice(0, 12));
    expect(created.body.apiKey.keyHash).toBeUndefined();
    expect(created.body.apiKey.scopes).toEqual(["models:read", "chat:write"]);

    const stored = await dataSource.query("select keyPrefix, keyHash from platform_api_keys where id = ?", [created.body.apiKey.id]);
    expect(stored).toHaveLength(1);
    expect(stored[0].keyPrefix).toBe(created.body.apiKey.key.slice(0, 12));
    expect(stored[0].keyHash).not.toContain(created.body.apiKey.key);
    expect(stored[0].keyHash).toMatch(/^[a-f0-9]{64}$/);

    const list = await request(server.app)
      .get(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`);
    expect(list.status).toBe(200);
    expect(list.body.apiKeys).toHaveLength(1);
    expect(list.body.apiKeys[0].key).toBeUndefined();
    expect(list.body.apiKeys[0].keyHash).toBeUndefined();
    expect(list.body.apiKeys[0].keyPrefix).toBe(created.body.apiKey.keyPrefix);

    const models = await request(server.app).get("/v1/models").set("Authorization", `Bearer ${created.body.apiKey.key}`);
    expect(models.status).toBe(200);
    expect(models.body.object).toBe("list");
    expect(models.body.data.length).toBeGreaterThan(0);
  });

  it("revokes, expires, and isolates team API keys", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const otherRegister = await request(server.app).post("/api/auth/register").send({
      email: "other-owner@example.com",
      name: "Other Owner",
      password: "secure-password-456",
      teamName: "Other Team",
    });

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ name: "Revoke Me", scopes: ["models:read"], expiresAt: "2999-01-01T00:00:00.000Z" });
    expect(created.status).toBe(201);

    const isolated = await request(server.app)
      .get(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${otherRegister.body.token}`);
    expect(isolated.status).toBe(404);

    const revoke = await request(server.app)
      .delete(`/api/teams/${server.teamId}/api-keys/${created.body.apiKey.id}`)
      .set("Authorization", `Bearer ${server.token}`);
    expect(revoke.status).toBe(204);

    const revokedModels = await request(server.app).get("/v1/models").set("Authorization", `Bearer ${created.body.apiKey.key}`);
    expect(revokedModels.status).toBe(401);

    const expired = await request(server.app)
      .post(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ name: "Expired Key", scopes: ["models:read"], expiresAt: "2000-01-01T00:00:00.000Z" });
    expect(expired.status).toBe(201);

    const expiredModels = await request(server.app).get("/v1/models").set("Authorization", `Bearer ${expired.body.apiKey.key}`);
    expect(expiredModels.status).toBe(401);
  });

  it("enforces per-key rate limits on /v1 access", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ name: "Limited Key", scopes: ["models:read"], rateLimitRpm: 1 });
    expect(created.status).toBe(201);

    await request(server.app).get("/v1/models").set("Authorization", `Bearer ${created.body.apiKey.key}`).expect(200);
    const limited = await request(server.app).get("/v1/models").set("Authorization", `Bearer ${created.body.apiKey.key}`);
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("rate_limit_exceeded");
  });

  it("updates metadata and audit-logs create/update/revoke operations", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ name: "Audit Key", scopes: ["models:read"], rateLimitRpm: 10 });
    expect(created.status).toBe(201);

    const updated = await request(server.app)
      .patch(`/api/teams/${server.teamId}/api-keys/${created.body.apiKey.id}`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ name: "Audit Key Updated", scopes: ["models:read", "chat:write"], rateLimitRpm: 20 });
    expect(updated.status).toBe(200);
    expect(updated.body.apiKey.name).toBe("Audit Key Updated");
    expect(updated.body.apiKey.scopes).toEqual(["models:read", "chat:write"]);
    expect(updated.body.apiKey.key).toBeUndefined();

    await request(server.app)
      .delete(`/api/teams/${server.teamId}/api-keys/${created.body.apiKey.id}`)
      .set("Authorization", `Bearer ${server.token}`)
      .expect(204);

    const logs = await dataSource.query("select action, resourceType, resourceId from audit_logs where teamId = ? order by createdAt asc", [server.teamId]);
    expect(logs.map((log: { action: string }) => log.action)).toEqual([
      "platform_api_key.created",
      "platform_api_key.updated",
      "platform_api_key.revoked",
    ]);
    expect(logs.every((log: { resourceType: string; resourceId: string }) => log.resourceType === "platform_api_key" && log.resourceId)).toBe(true);
  });
});
