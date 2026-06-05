import { afterEach, describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { createMigratedTestDataSource } from "../test/test-db.js";
import { seedDefaultModelGroups } from "./default-model-groups.js";
import { seedOpenCodeZenModels } from "./opencode-zen-models.js";

async function close(ds: DataSource) {
  if (ds.isInitialized) {
    await ds.destroy();
  }
}

describe("database migrations and seeds", () => {
  let dataSource: DataSource | undefined;

  afterEach(async () => {
    if (dataSource) {
      await close(dataSource);
      dataSource = undefined;
    }
  });

  it("creates the core production tables through migrations", async () => {
    dataSource = await createMigratedTestDataSource();

    const rows = await dataSource.query(
      "select name from sqlite_master where type = 'table' order by name",
    );
    const tableNames = rows.map((row: { name: string }) => row.name);

    expect(tableNames).toEqual(
      expect.arrayContaining([
        "users",
        "teams",
        "team_members",
        "platform_api_keys",
        "providers",
        "provider_api_keys",
        "provider_models",
        "model_pricings",
        "model_groups",
        "model_group_candidates",
        "session_affinities",
        "usage_events",
        "usage_daily_aggregates",
        "budget_policies",
        "budget_ledgers",
        "audit_logs",
        "invitations",
        "system_settings",
      ]),
    );
  });

  it("seeds OpenCode Zen provider, models, pricing, and groups idempotently", async () => {
    dataSource = await createMigratedTestDataSource();

    await seedOpenCodeZenModels(dataSource);
    await seedOpenCodeZenModels(dataSource);
    await seedDefaultModelGroups(dataSource);
    await seedDefaultModelGroups(dataSource);

    const providers = await dataSource.query("select * from providers where slug = ?", [
      "opencode-zen",
    ]);
    expect(providers).toHaveLength(1);

    const freeModels = await dataSource.query(
      "select externalModelId, isFree, pricingConfidence from provider_models where externalModelId in (?, ?, ?, ?)",
      ["big-pickle", "deepseek-v4-flash-free", "mimo-v2.5-free", "nemotron-3-ultra-free"],
    );
    expect(freeModels).toHaveLength(4);
    expect(freeModels.every((model: { isFree: number }) => model.isFree === 1)).toBe(true);
    expect(
      freeModels.every(
        (model: { pricingConfidence: string }) => model.pricingConfidence === "docs_pricing_verified",
      ),
    ).toBe(true);

    const inferredFreeModels = await dataSource.query(
      "select externalModelId, isFree, pricingConfidence from provider_models where externalModelId in (?, ?, ?)",
      ["qwen3.6-plus-free", "minimax-m3-free", "nemotron-3-super-free"],
    );
    expect(inferredFreeModels).toHaveLength(3);
    expect(inferredFreeModels.every((model: { isFree: number }) => model.isFree === 1)).toBe(true);
    expect(
      inferredFreeModels.every(
        (model: { pricingConfidence: string }) => model.pricingConfidence === "live_model_id_inferred",
      ),
    ).toBe(true);

    const pricingRows = await dataSource.query(
      "select mp.inputUsdPer1M, mp.outputUsdPer1M from model_pricings mp join provider_models pm on pm.id = mp.providerModelId where pm.externalModelId = ?",
      ["deepseek-v4-flash"],
    );
    expect(pricingRows).toHaveLength(1);
    expect(pricingRows[0].inputUsdPer1M).toBe(0.14);
    expect(pricingRows[0].outputUsdPer1M).toBe(0.28);

    const groups = await dataSource.query("select alias from model_groups order by alias");
    expect(groups.map((row: { alias: string }) => row.alias)).toEqual(
      expect.arrayContaining(["chat-default", "cheap", "coding", "fallback", "free-coding", "reasoning"]),
    );
  });
});
