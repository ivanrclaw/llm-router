import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { redactSecrets } from "../lib/redaction.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedDefaultModelGroups, seedOpenCodeZenModels } from "../seeds/index.js";
import { resetRateLimitBucketsForTests } from "../middleware/rate-limit.js";

const ORIGINAL_ENV = { ...process.env };

async function createAuthenticatedServer(dbName = "security-hardening-test") {
  const dataSource = await createMigratedTestDataSource(dbName);
  await seedOpenCodeZenModels(dataSource);
  await seedDefaultModelGroups(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email: `${dbName}@example.com`,
    name: "Security Owner",
    password: "secure-password-123",
    teamName: "Security Team",
  });
  expect(register.status).toBe(201);
  return { dataSource, app, token: register.body.token as string, teamId: register.body.teams[0].id as string };
}

describe("security hardening and auditability", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    resetRateLimitBucketsForTests();
    process.env = { ...ORIGINAL_ENV };
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("sets hardened HTTP security headers and only reflects configured CORS origins", async () => {
    process.env.CORS_ORIGIN = "https://dashboard.example.com";
    const server = await createAuthenticatedServer("security-headers-test");
    dataSource = server.dataSource;

    const allowed = await request(server.app)
      .get("/api/health")
      .set("Origin", "https://dashboard.example.com");

    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://dashboard.example.com");
    expect(allowed.headers["x-content-type-options"]).toBe("nosniff");
    expect(allowed.headers["x-frame-options"]).toBe("DENY");
    expect(allowed.headers["referrer-policy"]).toContain("no-referrer");
    expect(allowed.headers["content-security-policy"]).toContain("default-src 'self'");

    const denied = await request(server.app)
      .get("/api/health")
      .set("Origin", "https://evil.example.com");
    expect(denied.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rate-limits auth endpoints and unauthenticated /v1 requests before expensive work", async () => {
    const server = await createAuthenticatedServer("security-rate-limit-test");
    dataSource = server.dataSource;
    resetRateLimitBucketsForTests();
    process.env.AUTH_RATE_LIMIT_RPM = "1";
    process.env.V1_RATE_LIMIT_RPM = "1";

    await request(server.app).post("/api/auth/login").send({ email: "missing@example.com", password: "wrong" }).expect(401);
    const limitedAuth = await request(server.app).post("/api/auth/login").send({ email: "missing@example.com", password: "wrong" });
    expect(limitedAuth.status).toBe(429);
    expect(limitedAuth.body.error.code).toBe("rate_limit_exceeded");

    await request(server.app).get("/v1/models").set("Authorization", "Bearer invalid-one").expect(401);
    const limitedV1 = await request(server.app).get("/v1/models").set("Authorization", "Bearer invalid-one");
    expect(limitedV1.status).toBe(429);
    expect(limitedV1.body.error.code).toBe("rate_limit_exceeded");
  });

  it("redacts provider/platform secrets, bearer tokens, password hashes, and encrypted payloads recursively", () => {
    const redacted = redactSecrets({
      authorization: "Bearer lr_live_secret_123456789",
      password: "correct horse battery staple",
      passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
      key: "oz_live_secret_123456",
      encryptedKey: "abc:def:0123456789abcdef",
      nested: { apiKey: "sk-provider-secret", tokenHash: "sha256-token-hash" },
      message: "Failed with key oz_live_secret_123456 and bearer lr_live_secret_123456789",
    });

    expect(JSON.stringify(redacted)).not.toContain("oz_live_secret_123456");
    expect(JSON.stringify(redacted)).not.toContain("lr_live_secret_123456789");
    expect(JSON.stringify(redacted)).not.toContain("correct horse");
    expect(JSON.stringify(redacted)).not.toContain("$2b$10$");
    expect(redacted).toMatchObject({
      authorization: "[REDACTED]",
      password: "[REDACTED]",
      passwordHash: "[REDACTED]",
      key: "[REDACTED]",
      encryptedKey: "[REDACTED]",
      nested: { apiKey: "[REDACTED]", tokenHash: "[REDACTED]" },
      message: expect.stringContaining("[REDACTED]"),
    });
  });

  it("audit-logs sensitive provider mutations with hashed client metadata and no plaintext secrets", async () => {
    const server = await createAuthenticatedServer("security-audit-hash-test");
    dataSource = server.dataSource;

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .set("X-Forwarded-For", "203.0.113.24")
      .set("User-Agent", "SecurityProbe/1.0")
      .send({ providerSlug: "opencode-zen", name: "Audited", key: "oz_live_secret_for_audit", priority: 10 });
    expect(created.status).toBe(201);

    const rows = await dataSource.query("select ipHash, userAgentHash, metadataJson from audit_logs where action = 'provider_api_key.created' and teamId = ?", [server.teamId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].ipHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].userAgentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(rows[0].ipHash).not.toContain("203.0.113.24");
    expect(rows[0].userAgentHash).not.toContain("SecurityProbe");
    expect(rows[0].metadataJson).not.toContain("oz_live_secret_for_audit");
    expect(JSON.parse(rows[0].metadataJson)).toMatchObject({ keyPrefix: "oz_live_", providerSlug: "opencode-zen" });
  });

  it("enforces a dashboard permission matrix across key, provider, model-group, and budget route families", async () => {
    const server = await createAuthenticatedServer("security-permission-matrix-test");
    dataSource = server.dataSource;

    const viewer = await request(server.app).post("/api/auth/register").send({
      email: "security-viewer@example.com",
      name: "Security Viewer",
      password: "secure-password-456",
      teamName: "Viewer Personal Team",
    });
    const invite = await request(server.app)
      .post(`/api/teams/${server.teamId}/invitations`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ email: "security-viewer@example.com", role: "viewer" });
    await request(server.app).post(`/api/invitations/${invite.body.token}/accept`).set("Authorization", `Bearer ${viewer.body.token}`).expect(200);

    const reads = await Promise.all([
      request(server.app).get(`/api/teams/${server.teamId}/api-keys`).set("Authorization", `Bearer ${viewer.body.token}`),
      request(server.app).get(`/api/teams/${server.teamId}/provider-keys`).set("Authorization", `Bearer ${viewer.body.token}`),
      request(server.app).get(`/api/teams/${server.teamId}/model-groups`).set("Authorization", `Bearer ${viewer.body.token}`),
      request(server.app).get(`/api/teams/${server.teamId}/budgets`).set("Authorization", `Bearer ${viewer.body.token}`),
    ]);
    expect(reads.map((response) => response.status)).toEqual([200, 200, 200, 200]);

    const writes = await Promise.all([
      request(server.app).post(`/api/teams/${server.teamId}/api-keys`).set("Authorization", `Bearer ${viewer.body.token}`).send({ name: "nope" }),
      request(server.app).post(`/api/teams/${server.teamId}/provider-keys`).set("Authorization", `Bearer ${viewer.body.token}`).send({ providerSlug: "opencode-zen", name: "nope", key: "oz_nope" }),
      request(server.app).post(`/api/teams/${server.teamId}/model-groups`).set("Authorization", `Bearer ${viewer.body.token}`).send({ alias: "nope", displayName: "Nope" }),
      request(server.app).put(`/api/teams/${server.teamId}/budgets/team/${server.teamId}`).set("Authorization", `Bearer ${viewer.body.token}`).send({ monthlyBudgetUsdCents: 100 }),
    ]);
    expect(writes.map((response) => response.status)).toEqual([403, 403, 403, 403]);
  });
});
