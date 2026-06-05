import { afterEach, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ModelGroupService } from "./model-group.service.js";
import { RouterService } from "./router.service.js";
import { SessionAffinityService } from "./session-affinity.service.js";

async function createRoutableTeam() {
  const dataSource = await createMigratedTestDataSource("session-affinity-test");
  await seedOpenCodeZenModels(dataSource);
  const teamId = "team-affinity-1";
  const platformApiKeyId = "platform-key-1";
  await dataSource.query("insert into users (id, email, name, passwordHash) values ('user-affinity-1', 'affinity@example.com', 'Affinity User', 'hash')");
  await dataSource.query("insert into teams (id, name, slug, ownerId) values (?, 'Affinity Team', 'affinity-team', 'user-affinity-1')", [teamId]);
  await dataSource.query("insert into team_members (id, teamId, userId, role, isActive) values ('member-affinity-1', ?, 'user-affinity-1', 'owner', 1)", [teamId]);
  await dataSource.query("insert into platform_api_keys (id, teamId, userId, name, keyPrefix, keyHash, scopesJson) values (?, ?, 'user-affinity-1', 'Affinity Key', 'lr_test', 'hash', '[\"models:read\"]')", [platformApiKeyId, teamId]);
  await new ModelGroupService(dataSource).ensureDefaultGroups(teamId);
  return { dataSource, teamId, platformApiKeyId };
}

describe("sticky session affinity", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("stores only a hashed session key and reuses the same model for the same logical session", async () => {
    const fixture = await createRoutableTeam();
    dataSource = fixture.dataSource;
    const router = new RouterService(dataSource);

    const first = await router.resolve({
      teamId: fixture.teamId,
      platformApiKeyId: fixture.platformApiKeyId,
      requestedModel: "coding",
      endpointType: "openai_chat_completions",
      session: { headerSessionId: "raw-session-alpha", metadataSessionId: "metadata-alpha", userId: "user-alpha" },
    });
    const second = await router.resolve({
      teamId: fixture.teamId,
      platformApiKeyId: fixture.platformApiKeyId,
      requestedModel: "coding",
      endpointType: "openai_chat_completions",
      session: { headerSessionId: "raw-session-alpha", metadataSessionId: "metadata-alpha", userId: "user-alpha" },
    });

    expect(second.externalModelId).toBe(first.externalModelId);
    const rows = await dataSource.query("select * from session_affinities where teamId = ?", [fixture.teamId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionKeyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).not.toContain("raw-session-alpha");
    expect(JSON.stringify(rows)).not.toContain("metadata-alpha");
    expect(Number(rows[0].hitCount)).toBe(1);
  });

  it("can resolve different sessions to different weighted candidates while keeping each session stable", async () => {
    const fixture = await createRoutableTeam();
    dataSource = fixture.dataSource;
    const router = new RouterService(dataSource);

    const bySession = new Map<string, string>();
    for (let index = 0; index < 40; index += 1) {
      const sessionId = `weighted-session-${index}`;
      const first = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", endpointType: "openai_chat_completions", session: { headerSessionId: sessionId } });
      const second = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", endpointType: "openai_chat_completions", session: { headerSessionId: sessionId } });
      expect(second.externalModelId).toBe(first.externalModelId);
      bySession.set(sessionId, first.externalModelId);
    }

    expect(new Set(bySession.values()).size).toBeGreaterThan(1);
  });

  it("expires old affinities and creates a fresh affinity after TTL", async () => {
    const fixture = await createRoutableTeam();
    dataSource = fixture.dataSource;
    const router = new RouterService(dataSource);

    const first = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "free-coding", endpointType: "openai_chat_completions", session: { headerSessionId: "expires-session" } });
    await dataSource.query("update session_affinities set expiresAt = datetime('now', '-1 second') where requestedModel = 'free-coding'");
    const second = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "free-coding", endpointType: "openai_chat_completions", session: { headerSessionId: "expires-session" } });

    expect(second.externalModelId).toBeTruthy();
    const rows = await dataSource.query("select * from session_affinities where requestedModel = 'free-coding'");
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0].expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(rows[0].providerModelId).toBe(second.id);
    expect(rows[0].providerModelId).not.toBe(first.id === second.id ? "" : first.id);
  });

  it("breaks affinity when the stored model becomes disabled and re-resolves to a valid fallback", async () => {
    const fixture = await createRoutableTeam();
    dataSource = fixture.dataSource;
    const router = new RouterService(dataSource);

    const first = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "free-coding", endpointType: "openai_chat_completions", session: { headerSessionId: "disabled-session" } });
    await dataSource.query("update provider_models set isEnabled = 0 where id = ?", [first.id]);
    const second = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "free-coding", endpointType: "openai_chat_completions", session: { headerSessionId: "disabled-session" } });

    expect(second.id).not.toBe(first.id);
    expect(second.isEnabled).toBe(true);
    const rows = await dataSource.query("select providerModelId, failureCount from session_affinities where requestedModel = 'free-coding'");
    expect(rows[0].providerModelId).toBe(second.id);
    expect(Number(rows[0].failureCount)).toBeGreaterThanOrEqual(1);
  });

  it("marks an affinity as degraded after repeated failures and then allows fallback", async () => {
    const fixture = await createRoutableTeam();
    dataSource = fixture.dataSource;
    const router = new RouterService(dataSource);
    const affinity = new SessionAffinityService(dataSource);

    const first = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", endpointType: "openai_chat_completions", session: { headerSessionId: "degraded-session" } });
    await affinity.recordFailure({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", sessionKey: "degraded-session" });
    await affinity.recordFailure({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", sessionKey: "degraded-session" });
    await affinity.recordFailure({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", sessionKey: "degraded-session" });
    await dataSource.query("update provider_models set isEnabled = 0 where id = ?", [first.id]);

    const fallback = await router.resolve({ teamId: fixture.teamId, platformApiKeyId: fixture.platformApiKeyId, requestedModel: "coding", endpointType: "openai_chat_completions", session: { headerSessionId: "degraded-session" } });
    expect(fallback.id).not.toBe(first.id);
    const rows = await dataSource.query("select isDegraded, failureCount from session_affinities where requestedModel = 'coding'");
    expect(Number(rows[0].isDegraded)).toBe(1);
    expect(Number(rows[0].failureCount)).toBeGreaterThanOrEqual(3);
  });
});
