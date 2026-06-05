import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ModelGroupService } from "../services/model-group.service.js";
import { RouterService } from "../services/router.service.js";

async function createAuthenticatedServer() {
  const dataSource = await createMigratedTestDataSource("model-groups-test");
  await seedOpenCodeZenModels(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email: "groups-owner@example.com",
    name: "Groups Owner",
    password: "secure-password-123",
    teamName: "Model Groups Team",
  });
  return { dataSource, app, token: register.body.token as string, teamId: register.body.teams[0].id as string };
}

describe("model groups and routing policy", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("creates, lists, updates, and deletes team model groups with ordered weighted candidates", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    const candidates = await dataSource.query(
      "select id from provider_models where externalModelId in (?, ?) order by externalModelId asc",
      ["big-pickle", "deepseek-v4-flash-free"],
    );

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/model-groups`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({
        alias: "custom-coding",
        displayName: "Custom Coding",
        description: "Team coding alias",
        stickySessionTtlSeconds: 3600,
        policy: { endpointType: "openai_chat_completions", requiredTags: ["coding"], freeOnly: true },
        candidates: [
          { providerModelId: candidates[1].id, priority: 20, weight: 1 },
          { providerModelId: candidates[0].id, priority: 10, weight: 3 },
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.group).toMatchObject({ alias: "custom-coding", displayName: "Custom Coding", teamId: server.teamId });
    expect(created.body.group.policy).toMatchObject({ freeOnly: true, requiredTags: ["coding"] });
    expect(created.body.group.candidates.map((candidate: { priority: number; weight: number }) => [candidate.priority, candidate.weight])).toEqual([[10, 3], [20, 1]]);

    const listed = await request(server.app).get(`/api/teams/${server.teamId}/model-groups`).set("Authorization", `Bearer ${server.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.groups.some((group: { alias: string }) => group.alias === "custom-coding")).toBe(true);

    const updated = await request(server.app)
      .patch(`/api/teams/${server.teamId}/model-groups/${created.body.group.id}`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ displayName: "Updated Coding", isEnabled: false });
    expect(updated.status).toBe(200);
    expect(updated.body.group).toMatchObject({ displayName: "Updated Coding", isEnabled: false });

    const deleted = await request(server.app).delete(`/api/teams/${server.teamId}/model-groups/${created.body.group.id}`).set("Authorization", `Bearer ${server.token}`);
    expect(deleted.status).toBe(204);
  });

  it("resolves coding and free-coding groups using endpoint, tag, cost, enabled and deprecated constraints", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    const service = new ModelGroupService(dataSource);
    await service.ensureDefaultGroups(server.teamId);

    const router = new RouterService(dataSource);
    const coding = await router.resolve({ teamId: server.teamId, requestedModel: "coding", endpointType: "openai_chat_completions" });
    expect(coding.externalModelId).toBe("big-pickle");
    expect(coding.tags).toContain("coding");

    const freeCoding = await router.resolve({ teamId: server.teamId, requestedModel: "free-coding", endpointType: "openai_chat_completions" });
    expect(freeCoding.isFree).toBe(true);
    expect(freeCoding.currentPricing?.inputUsdPer1M).toBe(0);

    await dataSource.query("update provider_models set isEnabled = 0 where externalModelId = ?", [freeCoding.externalModelId]);
    const fallback = await router.resolve({ teamId: server.teamId, requestedModel: "free-coding", endpointType: "openai_chat_completions" });
    expect(fallback.externalModelId).not.toBe(freeCoding.externalModelId);
    expect(fallback.isFree).toBe(true);

    await dataSource.query("update provider_models set deprecatedAt = CURRENT_TIMESTAMP where externalModelId = ?", [fallback.externalModelId]);
    const afterDeprecated = await router.resolve({ teamId: server.teamId, requestedModel: "free-coding", endpointType: "openai_chat_completions" });
    expect(afterDeprecated.externalModelId).not.toBe(fallback.externalModelId);
    expect(afterDeprecated.deprecatedAt).toBeNull();
  });

  it("rejects incompatible candidates and reports UI warnings for non-chat or expensive candidates", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    const [nonChat] = await dataSource.query(
      `insert into provider_models (id, providerId, externalModelId, displayName, endpointType, tagsJson, capabilitiesJson, isFree, isEnabled, pricingConfidence, metadataJson)
       select 'non-chat-model-id', providerId, 'embed-only-free', 'Embed Only Free', 'google_model_endpoint', '["free"]', '{}', 1, 1, 'live_model_id_inferred', '{}' from provider_models limit 1
       returning id`,
    );

    const created = await request(server.app)
      .post(`/api/teams/${server.teamId}/model-groups`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({
        alias: "bad-chat",
        displayName: "Bad Chat",
        policy: { endpointType: "openai_chat_completions", freeOnly: true },
        candidates: [{ providerModelId: nonChat.id, priority: 1, weight: 1 }],
      });

    expect(created.status).toBe(400);
    expect(created.body.error.code).toBe("incompatible_model_group_candidate");
    expect(created.body.error.details[0].reasons).toContain("endpoint_incompatible");

    const warnings = await request(server.app)
      .post(`/api/teams/${server.teamId}/model-groups/validate`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ policy: { endpointType: "openai_chat_completions", freeOnly: true }, candidates: [{ providerModelId: nonChat.id }] });
    expect(warnings.status).toBe(200);
    expect(warnings.body.warnings[0]).toMatchObject({ providerModelId: nonChat.id });
    expect(warnings.body.warnings[0].reasons).toContain("endpoint_incompatible");
  });

  it("includes enabled aliases and concrete chat-compatible models in /v1/models", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    await new ModelGroupService(dataSource).ensureDefaultGroups(server.teamId);
    const createdKey = await request(server.app)
      .post(`/api/teams/${server.teamId}/api-keys`)
      .set("Authorization", `Bearer ${server.token}`)
      .send({ name: "Client", scopes: ["models:read"] });

    const models = await request(server.app).get("/v1/models").set("Authorization", `Bearer ${createdKey.body.apiKey.key}`);

    expect(models.status).toBe(200);
    const ids = models.body.data.map((model: { id: string }) => model.id);
    expect(ids).toContain("coding");
    expect(ids).toContain("free-coding");
    expect(ids).toContain("big-pickle");
    const alias = models.body.data.find((model: { id: string }) => model.id === "coding");
    expect(alias.metadata.llm_router_type).toBe("model_group");
  });
});
