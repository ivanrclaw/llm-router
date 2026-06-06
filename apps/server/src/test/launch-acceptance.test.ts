import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";

function providerChatResponse(content: string, usage = { prompt_tokens: 10_000, completion_tokens: 10_000, total_tokens: 20_000 }) {
  return new Response(JSON.stringify({
    id: `chatcmpl_${content}`,
    object: "chat.completion",
    created: 1710000000,
    model: "big-pickle",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage,
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function chatPayload(model: string, content = "Write a TypeScript debounce function") {
  return { model, messages: [{ role: "user", content }], max_tokens: 100 };
}

describe("Sprint 14 launch acceptance", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("proves the full launch flow from registration to OpenAI-compatible usage, budgets, stats, audit, and secret safety", async () => {
    dataSource = await createMigratedTestDataSource("launch-acceptance-test");
    const app = createApp({ dataSource });

    const syncFetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ data: [
      { id: "big-pickle", name: "Big Pickle", endpointType: "openai_chat_completions" },
      { id: "deepseek-v4-flash-free", name: "DeepSeek V4 Flash Free", endpointType: "openai_chat_completions" },
      { id: "embed-only-free", name: "Embed Only Free", endpointType: "google_model_endpoint" },
    ] }), { status: 200, headers: { "content-type": "application/json" } }));

    const registered = await request(app).post("/api/auth/register").send({
      email: "launch-owner@example.com",
      name: "Launch Owner",
      password: "secure-password-123",
      teamName: "Launch Team",
    });
    expect(registered.status).toBe(201);
    const token = registered.body.token as string;
    const originalTeamId = registered.body.teams[0].id as string;

    const createdTeam = await request(app)
      .post("/api/teams")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Launch Workspace", slug: "launch-workspace" });
    expect(createdTeam.status).toBe(201);
    const teamId = createdTeam.body.team.id as string;
    expect(teamId).not.toBe(originalTeamId);

    const synced = await request(app).post("/api/models/sync/opencode-zen").set("Authorization", `Bearer ${token}`);
    expect(synced.status).toBe(200);
    expect(synced.body.sync).toMatchObject({ fetched: 3, upserted: 3 });
    expect(syncFetch).toHaveBeenCalledWith("https://opencode.ai/zen/v1/models", expect.objectContaining({ headers: { Accept: "application/json" } }));

    const models = await request(app).get("/api/models?chatCompatible=true").set("Authorization", `Bearer ${token}`);
    expect(models.status).toBe(200);
    const bigPickle = models.body.models.find((model: { externalModelId: string }) => model.externalModelId === "big-pickle");
    const deepseekFree = models.body.models.find((model: { externalModelId: string }) => model.externalModelId === "deepseek-v4-flash-free");
    expect(bigPickle).toBeTruthy();
    expect(deepseekFree).toBeTruthy();
    expect(bigPickle.currentPricing).toMatchObject({ inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: false, pricingConfidence: "unknown" });

    const providerKey = await request(app)
      .post(`/api/teams/${teamId}/provider-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "OpenCode Zen launch", providerSlug: "opencode-zen", key: "oz_launch_secret", priority: 10 });
    expect(providerKey.status).toBe(201);
    expect(providerKey.body.providerKey).not.toHaveProperty("encryptedKey");

    const apiKey = await request(app)
      .post(`/api/teams/${teamId}/api-keys`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Launch client", scopes: ["models:read", "chat:write"] });
    expect(apiKey.status).toBe(201);
    const platformKey = apiKey.body.apiKey.key as string;
    expect(platformKey).toMatch(/^lr_/);

    const groupsBefore = await request(app).get(`/api/teams/${teamId}/model-groups`).set("Authorization", `Bearer ${token}`);
    expect(groupsBefore.status).toBe(200);
    const freeCoding = groupsBefore.body.groups.find((group: { alias: string }) => group.alias === "free-coding");
    expect(freeCoding.candidates.length).toBeGreaterThan(0);

    const aliasModels = await request(app).get("/v1/models").set("Authorization", `Bearer ${platformKey}`);
    expect(aliasModels.status).toBe(200);
    const modelIds = aliasModels.body.data.map((model: { id: string }) => model.id);
    expect(modelIds).toEqual(expect.arrayContaining(["big-pickle", "deepseek-v4-flash-free", "free-coding"]));

    const customGroup = await request(app)
      .post(`/api/teams/${teamId}/model-groups`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        alias: "launch-coding",
        displayName: "Launch Coding",
        policy: { endpointType: "openai_chat_completions", requiredTags: ["coding"] },
        candidates: [{ providerModelId: deepseekFree.id, priority: 10, weight: 1 }],
      });
    expect(customGroup.status).toBe(201);

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(providerChatResponse("concrete ok"))
      .mockResolvedValueOnce(providerChatResponse("alias first"))
      .mockResolvedValueOnce(providerChatResponse("alias sticky"));

    const concrete = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${platformKey}`)
      .send(chatPayload("big-pickle", "CONCRETE_PROMPT_SHOULD_NOT_PERSIST"));
    expect(concrete.status).toBe(200);
    expect(concrete.body.choices[0].message.content).toBe("concrete ok");
    expect(concrete.headers["x-llm-router-resolved-model"]).toBe("big-pickle");

    const aliasFirst = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${platformKey}`)
      .set("X-Session-Id", "launch-session-raw")
      .send(chatPayload("free-coding"));
    expect(aliasFirst.status).toBe(200);
    const stickyModel = aliasFirst.headers["x-llm-router-resolved-model"];
    expect(stickyModel).toBeTruthy();

    const aliasSticky = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${platformKey}`)
      .set("X-Session-Id", "launch-session-raw")
      .send(chatPayload("free-coding"));
    expect(aliasSticky.status).toBe(200);
    expect(aliasSticky.headers["x-llm-router-resolved-model"]).toBe(stickyModel);

    const usageRows = await dataSource.query("select * from usage_events where teamId = ? order by createdAt asc", [teamId]);
    expect(usageRows).toHaveLength(3);
    expect(usageRows.every((row: { status: string }) => row.status === "success")).toBe(true);
    const aggregateRows = await dataSource.query("select * from usage_daily_aggregates where teamId = ?", [teamId]);
    expect(aggregateRows.length).toBeGreaterThan(0);
    const aggregateTotals = aggregateRows.reduce((totals: { requestCount: number; successCount: number; totalTokens: number }, row: { requestCount: number; successCount: number; totalTokens?: number; promptTokens: number; completionTokens: number }) => ({
      requestCount: totals.requestCount + Number(row.requestCount),
      successCount: totals.successCount + Number(row.successCount),
      totalTokens: totals.totalTokens + Number(row.totalTokens ?? row.promptTokens + row.completionTokens),
    }), { requestCount: 0, successCount: 0, totalTokens: 0 });
    expect(aggregateTotals).toMatchObject({ requestCount: 3, successCount: 3, totalTokens: 60000 });

    const stats = await request(app).get(`/api/teams/${teamId}/stats`).set("Authorization", `Bearer ${token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.overview).toMatchObject({ requestCount: 3, successCount: 3, totalTokens: 60000 });
    expect(stats.body.breakdowns.models.length).toBeGreaterThan(0);
    expect(stats.body.breakdowns.modelGroups.some((group: { id: string }) => group.id === "free-coding")).toBe(true);

    const csv = await request(app).get(`/api/teams/${teamId}/stats/export.csv`).set("Authorization", `Bearer ${token}`);
    expect(csv.status).toBe(200);
    expect(csv.text.split("\n")[0]).toContain("requestId,createdAt,status");

    const budget = await request(app)
      .put(`/api/teams/${teamId}/budgets/team/${teamId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ dailyBudgetUsdCents: 1, monthlyBudgetUsdCents: 1, hardLimit: true });
    expect(budget.status).toBe(200);
    await dataSource.query(
      "insert into budget_ledgers (id, scopeType, scopeId, periodType, periodKey, spentUsdCents) values ('launch-spent-daily', 'team', ?, 'daily', date('now'), 1)",
      [teamId],
    );
    const blocked = await request(app)
      .post("/v1/chat/completions")
      .set("Authorization", `Bearer ${platformKey}`)
      .send(chatPayload("big-pickle"));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatchObject({ code: "budget_exceeded", type: "insufficient_quota" });

    const auditRows = await dataSource.query("select action, metadataJson from audit_logs where teamId = ? order by createdAt asc", [teamId]);
    expect(auditRows.map((row: { action: string }) => row.action)).toEqual(expect.arrayContaining([
      "platform_api_key.created",
      "provider_api_key.created",
      "budget_policy.upserted",
      "model_group.created",
    ]));

    const serializedState = JSON.stringify({
      platformKeys: await dataSource.query("select * from platform_api_keys where teamId = ?", [teamId]),
      providerKeys: await dataSource.query("select * from provider_api_keys where teamId = ?", [teamId]),
      usage: await dataSource.query("select * from usage_events where teamId = ?", [teamId]),
      sessions: await dataSource.query("select * from session_affinities"),
      auditRows,
    });
    expect(serializedState).not.toContain("oz_launch_secret");
    expect(serializedState).not.toContain(platformKey);
    expect(serializedState).not.toContain("CONCRETE_PROMPT_SHOULD_NOT_PERSIST");
    expect(serializedState).not.toContain("launch-session-raw");
  });
});
