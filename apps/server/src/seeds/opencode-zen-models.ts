import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import type { PricingConfidence, ProviderEndpointType } from "../entities/ProviderModel.js";

const OPENCODE_ZEN_PROVIDER = {
  slug: "opencode-zen",
  displayName: "OpenCode Zen",
  baseUrl: "https://opencode.ai/zen/v1",
};

export type SeedModel = {
  externalModelId: string;
  displayName: string;
  endpointType: ProviderEndpointType;
  isFree: boolean;
  pricingConfidence: PricingConfidence;
  inputUsdPer1M: number;
  outputUsdPer1M: number;
  tags: string[];
  contextWindowTokens?: number;
};

export const OPENCODE_ZEN_MODELS: SeedModel[] = [
  {
    externalModelId: "big-pickle",
    displayName: "Big Pickle",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "docs_pricing_verified",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "coding"],
  },
  {
    externalModelId: "deepseek-v4-flash-free",
    displayName: "DeepSeek V4 Flash Free",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "docs_pricing_verified",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "cheap", "coding"],
  },
  {
    externalModelId: "mimo-v2.5-free",
    displayName: "MiMo V2.5 Free",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "docs_pricing_verified",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "coding"],
  },
  {
    externalModelId: "nemotron-3-ultra-free",
    displayName: "Nemotron 3 Ultra Free",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "docs_pricing_verified",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "reasoning"],
  },
  {
    externalModelId: "qwen3.6-plus-free",
    displayName: "Qwen 3.6 Plus Free",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "live_model_id_inferred",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "coding", "reasoning"],
  },
  {
    externalModelId: "minimax-m3-free",
    displayName: "MiniMax M3 Free",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "live_model_id_inferred",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "fallback"],
  },
  {
    externalModelId: "nemotron-3-super-free",
    displayName: "Nemotron 3 Super Free",
    endpointType: "openai_chat_completions",
    isFree: true,
    pricingConfidence: "live_model_id_inferred",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["free", "reasoning"],
  },
  {
    externalModelId: "deepseek-v4-flash",
    displayName: "DeepSeek V4 Flash",
    endpointType: "openai_chat_completions",
    isFree: false,
    pricingConfidence: "docs_pricing_verified",
    inputUsdPer1M: 0.14,
    outputUsdPer1M: 0.28,
    tags: ["cheap", "coding", "fallback"],
  },
  {
    externalModelId: "gpt-5.1",
    displayName: "GPT 5.1",
    endpointType: "openai_chat_completions",
    isFree: false,
    pricingConfidence: "unknown",
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    tags: ["reasoning", "fallback"],
  },
];

type RowWithId = { id: string };

async function getProviderId(dataSource: DataSource): Promise<string> {
  await dataSource.query(
    `insert into providers (id, slug, displayName, baseUrl, isEnabled)
     values (?, ?, ?, ?, 1)
     on conflict(slug) do update set displayName = excluded.displayName, baseUrl = excluded.baseUrl, isEnabled = 1, updatedAt = CURRENT_TIMESTAMP`,
    [randomUUID(), OPENCODE_ZEN_PROVIDER.slug, OPENCODE_ZEN_PROVIDER.displayName, OPENCODE_ZEN_PROVIDER.baseUrl],
  );

  const rows = (await dataSource.query("select id from providers where slug = ?", [
    OPENCODE_ZEN_PROVIDER.slug,
  ])) as RowWithId[];
  const provider = rows[0];
  if (!provider) {
    throw new Error("OpenCode Zen provider seed failed");
  }
  return provider.id;
}

async function getProviderModelId(dataSource: DataSource, providerId: string, model: SeedModel): Promise<string> {
  await dataSource.query(
    `insert into provider_models (id, providerId, externalModelId, displayName, endpointType, contextWindowTokens, tagsJson, capabilitiesJson, isFree, isEnabled, pricingConfidence, metadataJson)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     on conflict(providerId, externalModelId) do update set
       displayName = excluded.displayName,
       endpointType = excluded.endpointType,
       contextWindowTokens = excluded.contextWindowTokens,
       tagsJson = excluded.tagsJson,
       capabilitiesJson = excluded.capabilitiesJson,
       isFree = excluded.isFree,
       isEnabled = 1,
       pricingConfidence = excluded.pricingConfidence,
       metadataJson = excluded.metadataJson,
       updatedAt = CURRENT_TIMESTAMP`,
    [
      randomUUID(),
      providerId,
      model.externalModelId,
      model.displayName,
      model.endpointType,
      model.contextWindowTokens ?? null,
      JSON.stringify(model.tags),
      JSON.stringify({ chatCompletions: model.endpointType === "openai_chat_completions" }),
      model.isFree ? 1 : 0,
      model.pricingConfidence,
      JSON.stringify({ seededFrom: "sprint-1", providerSlug: OPENCODE_ZEN_PROVIDER.slug }),
    ],
  );

  const rows = (await dataSource.query(
    "select id from provider_models where providerId = ? and externalModelId = ?",
    [providerId, model.externalModelId],
  )) as RowWithId[];
  const providerModel = rows[0];
  if (!providerModel) {
    throw new Error(`Model seed failed for ${model.externalModelId}`);
  }
  return providerModel.id;
}

async function upsertCurrentPricing(dataSource: DataSource, providerModelId: string, model: SeedModel): Promise<void> {
  await dataSource.query("update model_pricings set effectiveTo = CURRENT_TIMESTAMP where providerModelId = ? and effectiveTo is null", [
    providerModelId,
  ]);
  await dataSource.query(
    `insert into model_pricings (id, providerModelId, currency, inputUsdPer1M, outputUsdPer1M, cachedReadUsdPer1M, cachedWriteUsdPer1M, isFree, pricingConfidence, sourceUrl, sourceUpdatedAt, effectiveFrom, effectiveTo)
     values (?, ?, 'USD', ?, ?, null, null, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, null)`,
    [
      randomUUID(),
      providerModelId,
      model.inputUsdPer1M,
      model.outputUsdPer1M,
      model.isFree ? 1 : 0,
      model.pricingConfidence,
      "https://opencode.ai/zen",
    ],
  );
}

export async function seedOpenCodeZenModels(dataSource: DataSource): Promise<void> {
  const providerId = await getProviderId(dataSource);
  for (const model of OPENCODE_ZEN_MODELS) {
    const providerModelId = await getProviderModelId(dataSource, providerId, model);
    const existingCurrentPricing = (await dataSource.query(
      `select id, inputUsdPer1M, outputUsdPer1M, isFree, pricingConfidence
       from model_pricings
       where providerModelId = ? and effectiveTo is null`,
      [providerModelId],
    )) as Array<{ inputUsdPer1M: number; outputUsdPer1M: number; isFree: number; pricingConfidence: string }>;

    const current = existingCurrentPricing[0];
    if (
      !current ||
      current.inputUsdPer1M !== model.inputUsdPer1M ||
      current.outputUsdPer1M !== model.outputUsdPer1M ||
      current.isFree !== (model.isFree ? 1 : 0) ||
      current.pricingConfidence !== model.pricingConfidence
    ) {
      await upsertCurrentPricing(dataSource, providerModelId, model);
    }
  }
}
