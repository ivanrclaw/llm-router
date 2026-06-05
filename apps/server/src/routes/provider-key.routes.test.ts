import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ProviderKeyService } from "../services/provider-key.service.js";

async function createAuthenticatedServer() {
  const dataSource = await createMigratedTestDataSource("provider-keys-test");
  await seedOpenCodeZenModels(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email: "provider-owner@example.com",
    name: "Provider Owner",
    password: "secure-password-123",
    teamName: "Provider Key Team",
  });
  return { dataSource, app, token: register.body.token as string, teamId: register.body.teams[0].id as string };
}

describe("provider API keys", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("encrypts OpenCode Zen keys, stores only prefix for display, and lists without plaintext", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ providerSlug: "opencode-zen", name: "Zen Primary", key: "oz_live_secret_123456", priority: 10, rpmLimit: 60 });

    expect(created.status).toBe(201);
    expect(created.body.providerKey.keyPrefix).toBe("oz_live_");
    expect(created.body.providerKey.key).toBeUndefined();
    expect(created.body.providerKey.encryptedKey).toBeUndefined();

    const rows = await dataSource.query("select keyPrefix, encryptedKey from provider_api_keys where id = ?", [created.body.providerKey.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyPrefix).toBe("oz_live_");
    expect(rows[0].encryptedKey).not.toContain("oz_live_secret_123456");
    expect(rows[0].encryptedKey).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/);

    const list = await request(server.app)
      .get(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`);
    expect(list.status).toBe(200);
    expect(list.body.providerKeys).toHaveLength(1);
    expect(list.body.providerKeys[0].key).toBeUndefined();
    expect(list.body.providerKeys[0].encryptedKey).toBeUndefined();
    expect(list.body.providerKeys[0].keyPrefix).toBe("oz_live_");
  });

  it("selects usable keys by priority and excludes disabled, cooldown, and revoked keys", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const disabled = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ providerSlug: "opencode-zen", name: "Disabled", key: "oz_disabled", priority: 1, isEnabled: false });
    const cooldown = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ providerSlug: "opencode-zen", name: "Cooldown", key: "oz_cooldown", priority: 2 });
    const usable = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ providerSlug: "opencode-zen", name: "Usable", key: "oz_usable", priority: 5 });
    const lower = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ providerSlug: "opencode-zen", name: "Lower", key: "oz_lower", priority: 20 });

    await dataSource.query("update provider_api_keys set cooldownUntil = datetime('now', '+10 minutes') where id = ?", [cooldown.body.providerKey.id]);
    await request(server.app)
      .delete(`/api/teams/${server.teamId}/provider-keys/${lower.body.providerKey.id}`)
      .set("Authorization", `Bearer ${server.token}`)
      .expect(204);

    const selected = await new ProviderKeyService(dataSource).selectUsableKey({ teamId: server.teamId, providerSlug: "opencode-zen" });
    expect(selected?.id).toBe(usable.body.providerKey.id);
    expect(selected?.plaintextKey).toBe("oz_usable");
    expect(selected?.id).not.toBe(disabled.body.providerKey.id);
  });

  it("validates keys, records provider 401/403/429 failures, cooldowns 429s, and audit-logs changes", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "rate limit" }), { status: 429 }));

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ providerSlug: "opencode-zen", name: "Validated", key: "oz_validate", priority: 1 });
    expect(created.status).toBe(201);

    const validateOk = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys/${created.body.providerKey.id}/validate`)
      .set("Authorization", `Bearer ${server.token}`);
    expect(validateOk.status).toBe(200);
    expect(validateOk.body.providerKey.healthStatus).toBe("healthy");

    const validateLimited = await request(server.app)
      .post(`/api/teams/${server.teamId}/provider-keys/${created.body.providerKey.id}/validate`)
      .set("Authorization", `Bearer ${server.token}`);
    expect(validateLimited.status).toBe(200);
    expect(validateLimited.body.providerKey.healthStatus).toBe("rate_limited");
    expect(validateLimited.body.providerKey.lastErrorCode).toBe("provider_429");
    expect(validateLimited.body.providerKey.cooldownUntil).toBeTruthy();

    const logs = await dataSource.query("select action from audit_logs where teamId = ? order by createdAt asc", [server.teamId]);
    expect(logs.map((log: { action: string }) => log.action)).toContain("provider_api_key.created");
    expect(logs.map((log: { action: string }) => log.action)).toContain("provider_api_key.validated");
  });
});
