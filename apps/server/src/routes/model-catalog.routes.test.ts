import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { DataSource } from "typeorm";
import { randomUUID } from "crypto";
import { createApp } from "../app.js";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedOpenCodeZenModels } from "../seeds/index.js";
import { ModelCatalogService } from "../services/model-catalog.service.js";

async function createAuthenticatedServer() {
  const dataSource = await createMigratedTestDataSource("model-catalog-test");
  await seedOpenCodeZenModels(dataSource);
  const app = createApp({ dataSource });
  const register = await request(app).post("/api/auth/register").send({
    email: "models-owner@example.com",
    name: "Models Owner",
    password: "secure-password-123",
    teamName: "Model Catalog Team",
  });
  return { dataSource, app, token: register.body.token as string, teamId: register.body.teams[0].id as string };
}

describe("model catalog and OpenCode Zen sync", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (dataSource?.isInitialized) await dataSource.destroy();
    dataSource = undefined;
  });

  it("lists seeded free OpenCode Zen models with zero current pricing", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;

    const response = await request(server.app)
      .get("/api/models?provider=opencode-zen&free=true&endpointType=openai_chat_completions")
      .set("Authorization", `Bearer ${server.token}`);

    expect(response.status).toBe(200);
    const bigPickle = response.body.models.find((model: { externalModelId: string }) => model.externalModelId === "big-pickle");
    expect(bigPickle).toMatchObject({
      providerSlug: "opencode-zen",
      isFree: true,
      endpointType: "openai_chat_completions",
      pricingConfidence: "docs_pricing_verified",
      currentPricing: { inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: true },
    });
  });

  it("syncs live models idempotently, infers *-free models as free, and marks unknown paid metadata", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: "live-alpha-free", object: "model", created: 1780000000, owned_by: "opencode" },
            { id: "live-paid-pro", object: "model", created: 1780000001, owned_by: "opencode" },
          ],
        }),
        { status: 200 },
      ),
    );

    const first = await new ModelCatalogService(dataSource).syncOpenCodeZenModels();
    const second = await new ModelCatalogService(dataSource).syncOpenCodeZenModels();

    expect(first.upserted).toBeGreaterThanOrEqual(2);
    expect(second.created).toBe(0);
    const liveModels = await new ModelCatalogService(dataSource).list({ provider: "opencode-zen" });
    const free = liveModels.find((model) => model.externalModelId === "live-alpha-free");
    const paid = liveModels.find((model) => model.externalModelId === "live-paid-pro");
    expect(free?.isFree).toBe(true);
    expect(free?.pricingConfidence).toBe("live_model_id_inferred");
    expect(free?.currentPricing?.inputUsdPer1M).toBe(0);
    expect(paid?.isFree).toBe(false);
    expect(paid?.pricingConfidence).toBe("unknown");
    expect(paid?.sourceUrl).toBe("https://opencode.ai/zen/v1/models");
    expect(paid?.sourceUpdatedAt).toBeTruthy();
  });

  it("preserves manual/admin pricing overrides when live sync lacks pricing", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    const [model] = await dataSource.query("select id from provider_models where externalModelId = ?", ["deepseek-v4-flash"]);
    await dataSource.query("update model_pricings set effectiveTo = CURRENT_TIMESTAMP where providerModelId = ? and effectiveTo is null", [model.id]);
    await dataSource.query(
      `insert into model_pricings (id, providerModelId, currency, inputUsdPer1M, outputUsdPer1M, isFree, pricingConfidence, sourceUrl, sourceUpdatedAt, effectiveFrom, effectiveTo)
       values (?, ?, 'USD', 9, 10, 0, 'manual_admin_override', 'admin://manual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, null)`,
      [randomUUID(), model.id],
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "deepseek-v4-flash" }] }), { status: 200 }));

    await new ModelCatalogService(dataSource).syncOpenCodeZenModels();
    const [pricing] = await dataSource.query("select inputUsdPer1M, outputUsdPer1M, pricingConfidence from model_pricings where providerModelId = ? and effectiveTo is null", [model.id]);

    expect(pricing).toMatchObject({ inputUsdPer1M: 9, outputUsdPer1M: 10, pricingConfidence: "manual_admin_override" });
  });

  it("supports filters and enable/disable without exposing non-chat models in chat-compatible listing", async () => {
    const server = await createAuthenticatedServer();
    dataSource = server.dataSource;
    const service = new ModelCatalogService(dataSource);
    await service.upsertLiveModelForTest({ id: "embed-only-free", endpointType: "google_model_endpoint", isFree: true, tags: ["free"] });
    await service.upsertLiveModelForTest({ id: "unknown-coder-pro", endpointType: "openai_chat_completions", isFree: false, tags: ["coding"] });

    const filtered = await request(server.app)
      .get("/api/models?provider=opencode-zen&pricing=unknown&coding=true&enabled=true")
      .set("Authorization", `Bearer ${server.token}`);
    expect(filtered.status).toBe(200);
    expect(filtered.body.models.every((model: { tags: string[]; isEnabled: boolean }) => model.tags.includes("coding") && model.isEnabled)).toBe(true);

    const chat = await request(server.app).get("/api/models/chat-compatible").set("Authorization", `Bearer ${server.token}`);
    expect(chat.status).toBe(200);
    expect(chat.body.models.some((model: { externalModelId: string }) => model.externalModelId === "embed-only-free")).toBe(false);

    const targetId = filtered.body.models[0].id;
    const disabled = await request(server.app).patch(`/api/models/${targetId}`).set("Authorization", `Bearer ${server.token}`).send({ isEnabled: false });
    expect(disabled.status).toBe(200);
    expect(disabled.body.model.isEnabled).toBe(false);
  });
});
