import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ProviderKeyService } from "../services/provider-key.service.js";
import { ModelGroupService } from "../services/model-group.service.js";

async function createStatsFixture(email = "stats-owner@example.com") {
  const dataSource = await createMigratedTestDataSource("stats-test");
  await seedOpenCodeZenModels(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email,
    name: "Stats Owner",
    password: "secure-password-123",
    teamName: "Stats Team",
  });
  const token = register.body.token as string;
  const teamId = register.body.teams[0].id as string;
  await new ModelGroupService(dataSource).ensureDefaultGroups(teamId);
  await new ProviderKeyService(dataSource).create(register.body.user.id, teamId, {
    name: "OpenCode Zen stats",
    providerSlug: "opencode-zen",
    key: "oz_stats_secret",
    priority: 10,
  });
  const apiKey = await request(app)
    .post(`/api/teams/${teamId}/api-keys`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Stats client", scopes: ["models:read", "chat:write"] });
  const providerKeyId = (await dataSource.query("select id from provider_api_keys where teamId = ? limit 1", [teamId]))[0].id as string;
  const modelId = (await dataSource.query("select id from provider_models where externalModelId = 'big-pickle' limit 1"))[0].id as string;
  const platformApiKeyId = apiKey.body.apiKey.id as string;
  return { dataSource, app, token, teamId, userId: register.body.user.id as string, platformApiKeyId, providerKeyId, modelId };
}

async function insertUsageEvent(dataSource: DataSource, overrides: Record<string, unknown>) {
  const defaults = {
    requestId: `req-${Math.random()}`,
    providerId: "opencode-zen",
    requestedModel: "coding",
    resolvedModel: "big-pickle",
    sessionKeyHash: "session-hash",
    status: "success",
    errorCode: null,
    httpStatus: 200,
    promptTokens: 100,
    completionTokens: 50,
    cachedReadTokens: 10,
    cachedWriteTokens: 5,
    totalTokens: 150,
    latencyMs: 100,
    costUsdCents: 12,
    savedUsdCents: 3,
    baselineModelId: null,
    usageSource: "provider",
    isStreaming: false,
    createdAt: "2026-06-01 10:00:00",
  };
  const row: Record<string, unknown> = { ...defaults, ...overrides };
  await dataSource.query(
    `insert into usage_events (id, requestId, teamId, userId, platformApiKeyId, providerId, providerApiKeyId, providerModelId, requestedModel, resolvedModel, sessionKeyHash, status, errorCode, httpStatus, promptTokens, completionTokens, cachedReadTokens, cachedWriteTokens, totalTokens, latencyMs, costUsdCents, savedUsdCents, baselineModelId, usageSource, isStreaming, createdAt)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id ?? crypto.randomUUID(), row.requestId, row.teamId, row.userId, row.platformApiKeyId, row.providerId, row.providerApiKeyId, row.providerModelId, row.requestedModel, row.resolvedModel, row.sessionKeyHash, row.status, row.errorCode, row.httpStatus, row.promptTokens, row.completionTokens, row.cachedReadTokens, row.cachedWriteTokens, row.totalTokens, row.latencyMs, row.costUsdCents, row.savedUsdCents, row.baselineModelId, row.usageSource, row.isStreaming ? 1 : 0, row.createdAt,
    ],
  );
}

describe("usage statistics dashboard API", () => {
  let dataSources: DataSource[] = [];

  afterEach(async () => {
    for (const dataSource of dataSources) if (dataSource.isInitialized) await dataSource.destroy();
    dataSources = [];
  });

  it("returns isolated overview, breakdowns, cache savings, errors, and latency percentiles", async () => {
    const first = await createStatsFixture("stats-a@example.com");
    const second = await createStatsFixture("stats-b@example.com");
    dataSources.push(first.dataSource, second.dataSource);

    await insertUsageEvent(first.dataSource, { teamId: first.teamId, userId: first.userId, platformApiKeyId: first.platformApiKeyId, providerApiKeyId: first.providerKeyId, providerModelId: first.modelId, requestedModel: "coding", latencyMs: 10, costUsdCents: 100, savedUsdCents: 20, cachedReadTokens: 100, cachedWriteTokens: 50, createdAt: "2026-06-01 10:00:00" });
    await insertUsageEvent(first.dataSource, { teamId: first.teamId, userId: first.userId, platformApiKeyId: first.platformApiKeyId, providerApiKeyId: first.providerKeyId, providerModelId: first.modelId, requestedModel: "coding", latencyMs: 20, costUsdCents: 200, savedUsdCents: 40, cachedReadTokens: 200, cachedWriteTokens: 100, createdAt: "2026-06-02 10:00:00" });
    await insertUsageEvent(first.dataSource, { teamId: first.teamId, userId: first.userId, platformApiKeyId: first.platformApiKeyId, providerApiKeyId: first.providerKeyId, providerModelId: first.modelId, requestedModel: "coding", latencyMs: 30, costUsdCents: 300, savedUsdCents: 60, cachedReadTokens: 300, cachedWriteTokens: 150, createdAt: "2026-06-02 11:00:00" });
    await insertUsageEvent(first.dataSource, { teamId: first.teamId, userId: first.userId, platformApiKeyId: first.platformApiKeyId, providerApiKeyId: first.providerKeyId, providerModelId: first.modelId, requestedModel: "coding", status: "error", errorCode: "provider_rate_limited", httpStatus: 429, latencyMs: 40, costUsdCents: 0, savedUsdCents: 0, cachedReadTokens: 0, cachedWriteTokens: 0, createdAt: "2026-06-02 12:00:00" });
    await insertUsageEvent(first.dataSource, { teamId: first.teamId, userId: first.userId, platformApiKeyId: first.platformApiKeyId, providerApiKeyId: first.providerKeyId, providerModelId: first.modelId, requestedModel: "writing", latencyMs: 5, costUsdCents: 999, savedUsdCents: 999, createdAt: "2026-06-02 13:00:00" });
    await insertUsageEvent(first.dataSource, { teamId: "other-team", userId: "other-user", platformApiKeyId: "other-platform-key", providerApiKeyId: "other-provider-key", providerModelId: first.modelId, requestedModel: "coding", costUsdCents: 9999, savedUsdCents: 9999, createdAt: "2026-06-02 10:00:00" });
    await insertUsageEvent(second.dataSource, { teamId: second.teamId, userId: second.userId, platformApiKeyId: second.platformApiKeyId, providerApiKeyId: second.providerKeyId, providerModelId: second.modelId, requestedModel: "coding", costUsdCents: 9999, savedUsdCents: 9999, createdAt: "2026-06-02 10:00:00" });

    const response = await request(first.app)
      .get(`/api/teams/${first.teamId}/stats?from=2026-06-01&to=2026-06-03&modelId=${first.modelId}&modelGroupId=coding&userId=${first.userId}&platformApiKeyId=${first.platformApiKeyId}&providerKeyId=${first.providerKeyId}`)
      .set("Authorization", `Bearer ${first.token}`);

    expect(response.status).toBe(200);
    expect(response.body.overview).toMatchObject({ requestCount: 4, successCount: 3, errorCount: 1, promptTokens: 400, completionTokens: 200, costUsdCents: 600, savedUsdCents: 120, cachedReadTokens: 600, cachedWriteTokens: 300 });
    expect(response.body.latency).toMatchObject({ p50LatencyMs: 20, p95LatencyMs: 40, avgLatencyMs: 25 });
    expect(response.body.errors).toEqual([{ errorCode: "provider_rate_limited", count: 1, httpStatus: 429 }]);
    expect(response.body.timeSeries).toEqual([
      expect.objectContaining({ date: "2026-06-01", requestCount: 1, costUsdCents: 100 }),
      expect.objectContaining({ date: "2026-06-02", requestCount: 3, costUsdCents: 500 }),
    ]);
    expect(response.body.breakdowns.models[0]).toMatchObject({ id: first.modelId, label: "big-pickle", requestCount: 4, costUsdCents: 600 });
    expect(response.body.breakdowns.users[0]).toMatchObject({ id: first.userId, requestCount: 4 });
    expect(response.body.breakdowns.platformApiKeys[0]).toMatchObject({ id: first.platformApiKeyId, requestCount: 4 });
    expect(response.body.breakdowns.providerKeys[0]).toMatchObject({ id: first.providerKeyId, requestCount: 4 });
    expect(response.body.breakdowns.modelGroups[0]).toMatchObject({ id: "coding", label: "coding", requestCount: 4 });
  });

  it("exports filtered usage events as CSV with expected columns", async () => {
    const fixture = await createStatsFixture("stats-csv@example.com");
    dataSources.push(fixture.dataSource);
    await insertUsageEvent(fixture.dataSource, { teamId: fixture.teamId, userId: fixture.userId, platformApiKeyId: fixture.platformApiKeyId, providerApiKeyId: fixture.providerKeyId, providerModelId: fixture.modelId, status: "success", errorCode: null, costUsdCents: 42, savedUsdCents: 7, createdAt: "2026-06-04 10:00:00" });

    const response = await request(fixture.app)
      .get(`/api/teams/${fixture.teamId}/stats/export.csv?from=2026-06-04&to=2026-06-05&modelId=${fixture.modelId}`)
      .set("Authorization", `Bearer ${fixture.token}`);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.text.split("\n")[0]).toBe("requestId,createdAt,status,errorCode,httpStatus,requestedModel,resolvedModel,providerModelId,userId,platformApiKeyId,providerApiKeyId,promptTokens,completionTokens,totalTokens,cachedReadTokens,cachedWriteTokens,latencyMs,costUsdCents,savedUsdCents,usageSource,isStreaming");
    expect(response.text).toContain("success");
    expect(response.text).toContain(",42,7,");
  });
});
