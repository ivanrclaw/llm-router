import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ProviderKeyService } from "../services/provider-key.service.js";
import { ModelGroupService } from "../services/model-group.service.js";

async function createUsageFixture(email = "usage-owner@example.com") {
  const dataSource = await createMigratedTestDataSource("usage-budget-test");
  await seedOpenCodeZenModels(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email,
    name: "Usage Owner",
    password: "secure-password-123",
    teamName: "Usage Team",
  });
  const token = register.body.token as string;
  const teamId = register.body.teams[0].id as string;
  await new ModelGroupService(dataSource).ensureDefaultGroups(teamId);
  await new ProviderKeyService(dataSource).create(register.body.user.id, teamId, {
    name: "OpenCode Zen usage",
    providerSlug: "opencode-zen",
    key: "oz_usage_secret",
    priority: 10,
  });
  const platformKey = await request(app)
    .post(`/api/teams/${teamId}/api-keys`)
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Usage client", scopes: ["models:read", "chat:write"] });
  return { dataSource, app, token, teamId, userId: register.body.user.id as string, platformKey: platformKey.body.apiKey.key as string };
}

async function makeBigPicklePaid(dataSource: DataSource) {
  const [model] = await dataSource.query("select id from provider_models where externalModelId = 'big-pickle'");
  await dataSource.query("update provider_models set isFree = 0, pricingConfidence = 'manual_admin_override' where id = ?", [model.id]);
  await dataSource.query("update model_pricings set effectiveTo = CURRENT_TIMESTAMP where providerModelId = ? and effectiveTo is null", [model.id]);
  await dataSource.query(
    `insert into model_pricings (id, providerModelId, currency, inputUsdPer1M, outputUsdPer1M, cachedReadUsdPer1M, cachedWriteUsdPer1M, isFree, pricingConfidence, sourceUrl, sourceUpdatedAt, effectiveFrom, effectiveTo)
     values ('paid-big-pickle-pricing', ?, 'USD', 100, 200, 10, 20, 0, 'manual_admin_override', 'test://pricing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, null)`,
    [model.id],
  );
  return model.id as string;
}

function providerJson(usage: Record<string, unknown>, content = "usage ok") {
  return new Response(JSON.stringify({
    id: "chatcmpl_usage",
    object: "chat.completion",
    created: 1710000000,
    model: "big-pickle",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function chatPayload(model = "coding") {
  return { model, messages: [{ role: "user", content: "usage prompt" }], max_tokens: 100 };
}

describe("usage accounting, costs, savings, and budgets", () => {
  let dataSources: DataSource[] = [];

  afterEach(async () => {
    vi.restoreAllMocks();
    for (const dataSource of dataSources) if (dataSource.isInitialized) await dataSource.destroy();
    dataSources = [];
  });

  it("records free model usage with zero cost and updates daily aggregates", async () => {
    const fixture = await createUsageFixture();
    dataSources.push(fixture.dataSource);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerJson({ prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 }));

    const response = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload());

    expect(response.status).toBe(200);
    const events = await fixture.dataSource.query("select * from usage_events");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: "success", promptTokens: 4, completionTokens: 2, totalTokens: 6, costUsdCents: 0, usageSource: "provider" });
    const aggregates = await fixture.dataSource.query("select * from usage_daily_aggregates where teamId = ?", [fixture.teamId]);
    expect(aggregates).toHaveLength(1);
    expect(aggregates[0]).toMatchObject({ requestCount: 1, successCount: 1, errorCount: 0, promptTokens: 4, completionTokens: 2, costUsdCents: 0 });
  });

  it("records free model savings against a configured paid baseline model", async () => {
    const fixture = await createUsageFixture("usage-baseline@example.com");
    dataSources.push(fixture.dataSource);
    const baselineModelId = await makeBigPicklePaid(fixture.dataSource);
    await fixture.dataSource.query("insert into system_settings (key, valueJson) values ('usage.baselineModelId', ?)", [JSON.stringify({ modelId: baselineModelId })]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerJson({ prompt_tokens: 10_000, completion_tokens: 10_000, total_tokens: 20_000 }));

    const response = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload("free-coding"));

    expect(response.status).toBe(200);
    const [event] = await fixture.dataSource.query("select * from usage_events");
    expect(event).toMatchObject({ costUsdCents: 0, savedUsdCents: 300, baselineModelId, usageSource: "provider" });
  });

  it("calculates paid model cost and cache savings from provider usage", async () => {
    const fixture = await createUsageFixture();
    dataSources.push(fixture.dataSource);
    await makeBigPicklePaid(fixture.dataSource);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(providerJson({
      prompt_tokens: 10_000,
      completion_tokens: 10_000,
      total_tokens: 20_000,
      prompt_tokens_details: { cached_tokens: 10_000 },
    }));

    const response = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload("big-pickle"));

    expect(response.status).toBe(200);
    const [event] = await fixture.dataSource.query("select * from usage_events");
    expect(event).toMatchObject({ promptTokens: 10000, completionTokens: 10000, cachedReadTokens: 10000, costUsdCents: 210, savedUsdCents: 90, usageSource: "provider" });
  });

  it("estimates missing provider usage and stores budget-blocked errors", async () => {
    const fixture = await createUsageFixture();
    dataSources.push(fixture.dataSource);
    await makeBigPicklePaid(fixture.dataSource);
    await request(fixture.app)
      .put(`/api/teams/${fixture.teamId}/budgets/team/${fixture.teamId}`)
      .set("Authorization", `Bearer ${fixture.token}`)
      .send({ dailyBudgetUsdCents: 1, monthlyBudgetUsdCents: 1, hardLimit: true });
    await fixture.dataSource.query(
      "insert into budget_ledgers (id, scopeType, scopeId, periodType, periodKey, spentUsdCents) values ('spent-daily', 'team', ?, 'daily', date('now'), 1)",
      [fixture.teamId],
    );

    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const blocked = await request(fixture.app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${fixture.platformKey}`)
      .send(chatPayload("big-pickle"));

    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatchObject({ code: "budget_exceeded", type: "insufficient_quota" });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    const [event] = await fixture.dataSource.query("select * from usage_events");
    expect(event).toMatchObject({ status: "error", errorCode: "budget_exceeded", httpStatus: 429, providerApiKeyId: null });
  });

  it("exposes budget routes with team isolation", async () => {
    const first = await createUsageFixture("usage-team-a@example.com");
    const second = await createUsageFixture("usage-team-b@example.com");
    dataSources.push(first.dataSource, second.dataSource);

    const saved = await request(first.app)
      .put(`/api/teams/${first.teamId}/budgets/team/${first.teamId}`)
      .set("Authorization", `Bearer ${first.token}`)
      .send({ dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] });
    expect(saved.status).toBe(200);
    expect(saved.body.policy).toMatchObject({ scopeType: "team", scopeId: first.teamId, dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] });

    const providerKeyId = (await first.dataSource.query("select id from provider_api_keys where teamId = ? limit 1", [first.teamId]))[0].id as string;
    const platformApiKeyId = (await first.dataSource.query("select id from platform_api_keys where teamId = ? limit 1", [first.teamId]))[0].id as string;
    const modelId = (await first.dataSource.query("select id from provider_models where externalModelId = 'big-pickle' limit 1"))[0].id as string;
    const modelGroupId = (await first.dataSource.query("select id from model_groups where teamId = ? and alias = 'coding' limit 1", [first.teamId]))[0].id as string;
    for (const [scopeType, scopeId] of [["provider_api_key", providerKeyId], ["platform_api_key", platformApiKeyId], ["model", modelId], ["model_group", modelGroupId]] as const) {
      const scoped = await request(first.app)
        .put(`/api/teams/${first.teamId}/budgets/${scopeType}/${scopeId}`)
        .set("Authorization", `Bearer ${first.token}`)
        .send({ dailyBudgetUsdCents: 100, hardLimit: true });
      expect(scoped.status).toBe(200);
      expect(scoped.body.policy).toMatchObject({ scopeType, scopeId });
    }

    const listed = await request(first.app).get(`/api/teams/${first.teamId}/budgets`).set("Authorization", `Bearer ${first.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.policies).toHaveLength(5);
    expect(listed.body.policies.map((policy: { scopeType: string }) => policy.scopeType).sort()).toEqual(["model", "model_group", "platform_api_key", "provider_api_key", "team"]);

    const forbidden = await request(first.app)
      .put(`/api/teams/${first.teamId}/budgets/team/${second.teamId}`)
      .set("Authorization", `Bearer ${first.token}`)
      .send({ dailyBudgetUsdCents: 1, hardLimit: true });
    expect(forbidden.status).toBe(400);
    expect(forbidden.body.error.code).toBe("invalid_budget_scope");
  });
});
