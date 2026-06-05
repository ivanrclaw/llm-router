import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import type { PricingConfidence, ProviderEndpointType } from "../entities/ProviderModel.js";

const OPENCODE_ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models";
const OPENCODE_ZEN_PROVIDER = { slug: "opencode-zen", displayName: "OpenCode Zen", baseUrl: "https://opencode.ai/zen/v1" };

type ProviderRow = { id: string; slug: string; displayName: string };
type ModelRow = {
  id: string; providerId: string; providerSlug: string; providerName: string; externalModelId: string; displayName: string;
  endpointType: ProviderEndpointType; contextWindowTokens: number | null; tagsJson: string; capabilitiesJson: string;
  isFree: number | boolean; isEnabled: number | boolean; pricingConfidence: PricingConfidence; metadataJson: string; deprecatedAt: string | null;
  createdAt: string; updatedAt: string; inputUsdPer1M: number | null; outputUsdPer1M: number | null; cachedReadUsdPer1M: number | null;
  cachedWriteUsdPer1M: number | null; pricingIsFree: number | boolean | null; pricingConfidenceCurrent: PricingConfidence | null;
  sourceUrl: string | null; sourceUpdatedAt: string | null;
};

export type ModelCatalogItem = {
  id: string; providerSlug: string; providerName: string; externalModelId: string; displayName: string; endpointType: ProviderEndpointType;
  contextWindowTokens: number | null; tags: string[]; capabilities: Record<string, unknown>; isFree: boolean; isEnabled: boolean;
  pricingConfidence: PricingConfidence; metadata: Record<string, unknown>; deprecatedAt: string | null; sourceUrl: string | null; sourceUpdatedAt: string | null;
  currentPricing: null | { inputUsdPer1M: number; outputUsdPer1M: number; cachedReadUsdPer1M: number | null; cachedWriteUsdPer1M: number | null; isFree: boolean; pricingConfidence: PricingConfidence; sourceUrl: string; sourceUpdatedAt: string };
};

export type ModelFilters = { provider?: string; endpointType?: string; free?: boolean; paid?: boolean; pricing?: string; coding?: boolean; enabled?: boolean; deprecated?: boolean; chatCompatible?: boolean };

function parseBool(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  return String(value) === "true" || value === "1";
}

export function filtersFromQuery(query: Record<string, unknown>): ModelFilters {
  return {
    provider: typeof query.provider === "string" ? query.provider : undefined,
    endpointType: typeof query.endpointType === "string" ? query.endpointType : undefined,
    free: parseBool(query.free), paid: parseBool(query.paid), coding: parseBool(query.coding), enabled: parseBool(query.enabled), deprecated: parseBool(query.deprecated),
    pricing: typeof query.pricing === "string" ? query.pricing : undefined,
    chatCompatible: parseBool(query.chatCompatible),
  };
}

function displayNameFromId(id: string): string {
  return id.replace(/[-_.]+/g, " ").replace(/\w/g, (char) => char.toUpperCase());
}

function endpointFromLive(model: Record<string, unknown>): ProviderEndpointType {
  const endpoint = String(model.endpointType ?? model.endpoint_type ?? "openai_chat_completions");
  if (["openai_chat_completions", "openai_responses", "anthropic_messages", "google_model_endpoint"].includes(endpoint)) return endpoint as ProviderEndpointType;
  return "openai_chat_completions";
}

function currentPricingForLive(id: string, existing?: ModelCatalogItem | null) {
  if (existing?.currentPricing?.pricingConfidence === "manual_admin_override") return null;
  const isFree = id.endsWith("-free") || id.includes("free");
  const pricingConfidence: PricingConfidence = isFree ? "live_model_id_inferred" : "unknown";
  return { isFree, pricingConfidence, inputUsdPer1M: 0, outputUsdPer1M: 0 };
}

function rowToItem(row: ModelRow): ModelCatalogItem {
  const tags = JSON.parse(row.tagsJson || "[]") as string[];
  const capabilities = JSON.parse(row.capabilitiesJson || "{}") as Record<string, unknown>;
  const metadata = JSON.parse(row.metadataJson || "{}") as Record<string, unknown>;
  return {
    id: row.id,
    providerSlug: row.providerSlug,
    providerName: row.providerName,
    externalModelId: row.externalModelId,
    displayName: row.displayName,
    endpointType: row.endpointType,
    contextWindowTokens: row.contextWindowTokens,
    tags,
    capabilities,
    isFree: row.isFree === true || row.isFree === 1,
    isEnabled: row.isEnabled === true || row.isEnabled === 1,
    pricingConfidence: row.pricingConfidence,
    metadata,
    deprecatedAt: row.deprecatedAt,
    sourceUrl: row.sourceUrl,
    sourceUpdatedAt: row.sourceUpdatedAt,
    currentPricing: row.inputUsdPer1M === null || row.inputUsdPer1M === undefined ? null : {
      inputUsdPer1M: Number(row.inputUsdPer1M),
      outputUsdPer1M: Number(row.outputUsdPer1M ?? 0),
      cachedReadUsdPer1M: row.cachedReadUsdPer1M === null ? null : Number(row.cachedReadUsdPer1M),
      cachedWriteUsdPer1M: row.cachedWriteUsdPer1M === null ? null : Number(row.cachedWriteUsdPer1M),
      isFree: row.pricingIsFree === true || row.pricingIsFree === 1,
      pricingConfidence: row.pricingConfidenceCurrent ?? row.pricingConfidence,
      sourceUrl: row.sourceUrl ?? "",
      sourceUpdatedAt: row.sourceUpdatedAt ?? "",
    },
  };
}

export class ModelCatalogService {
  constructor(private readonly dataSource: DataSource) {}

  async list(filters: ModelFilters = {}): Promise<ModelCatalogItem[]> {
    const clauses = ["p.isEnabled = 1"];
    const params: unknown[] = [];
    if (filters.provider) { clauses.push("p.slug = ?"); params.push(filters.provider); }
    if (filters.endpointType) { clauses.push("pm.endpointType = ?"); params.push(filters.endpointType); }
    if (filters.chatCompatible) clauses.push("pm.endpointType = 'openai_chat_completions'");
    if (filters.free !== undefined) { clauses.push("pm.isFree = ?"); params.push(filters.free ? 1 : 0); }
    if (filters.paid !== undefined) { clauses.push("pm.isFree = ?"); params.push(filters.paid ? 0 : 1); }
    if (filters.pricing) { clauses.push("pm.pricingConfidence = ?"); params.push(filters.pricing); }
    if (filters.enabled !== undefined) { clauses.push("pm.isEnabled = ?"); params.push(filters.enabled ? 1 : 0); }
    if (filters.deprecated !== undefined) clauses.push(filters.deprecated ? "pm.deprecatedAt is not null" : "pm.deprecatedAt is null");
    const rows = (await this.dataSource.query(
      `select pm.*, p.slug as providerSlug, p.displayName as providerName,
              mp.inputUsdPer1M, mp.outputUsdPer1M, mp.cachedReadUsdPer1M, mp.cachedWriteUsdPer1M,
              mp.isFree as pricingIsFree, mp.pricingConfidence as pricingConfidenceCurrent, mp.sourceUrl, mp.sourceUpdatedAt
       from provider_models pm join providers p on p.id = pm.providerId
       left join model_pricings mp on mp.providerModelId = pm.id and mp.effectiveTo is null
       where ${clauses.join(" and ")}
       order by pm.externalModelId asc`, params)) as ModelRow[];
    let models = rows.map(rowToItem);
    if (filters.coding) models = models.filter((model) => model.tags.includes("coding"));
    return models;
  }

  async listChatCompatible(): Promise<ModelCatalogItem[]> { return this.list({ chatCompatible: true, enabled: true }); }

  async update(modelId: string, input: Record<string, unknown>): Promise<ModelCatalogItem> {
    const current = await this.getById(modelId);
    await this.dataSource.query(
      `update provider_models set isEnabled = ?, deprecatedAt = ?, updatedAt = CURRENT_TIMESTAMP where id = ?`,
      [input.isEnabled === undefined ? (current.isEnabled ? 1 : 0) : input.isEnabled === false ? 0 : 1, input.deprecatedAt === undefined ? current.deprecatedAt : input.deprecatedAt, modelId],
    );
    return this.getById(modelId);
  }

  async syncOpenCodeZenModels(): Promise<{ fetched: number; created: number; upserted: number }> {
    const response = await fetch(OPENCODE_ZEN_MODELS_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw Object.assign(new Error("OpenCode Zen model sync failed"), { statusCode: 502 });
    const payload = (await response.json()) as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
    const live = Array.isArray(payload) ? payload : payload.data ?? [];
    const providerId = await this.ensureOpenCodeProvider();
    let created = 0;
    for (const liveModel of live) {
      const externalModelId = String(liveModel.id ?? "").trim();
      if (!externalModelId) continue;
      const before = await this.findByExternalId(providerId, externalModelId);
      const endpointType = endpointFromLive(liveModel);
      const tags = new Set<string>(before?.tags ?? []);
      if (externalModelId.includes("free")) tags.add("free");
      if (externalModelId.includes("code") || externalModelId.includes("coder") || externalModelId.includes("deepseek")) tags.add("coding");
      const inferred = currentPricingForLive(externalModelId, before);
      const modelId = before?.id ?? randomUUID();
      if (!before) created += 1;
      await this.dataSource.query(
        `insert into provider_models (id, providerId, externalModelId, displayName, endpointType, contextWindowTokens, tagsJson, capabilitiesJson, isFree, isEnabled, pricingConfidence, metadataJson)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
         on conflict(providerId, externalModelId) do update set displayName = excluded.displayName, endpointType = excluded.endpointType, tagsJson = excluded.tagsJson,
           capabilitiesJson = excluded.capabilitiesJson, isFree = excluded.isFree, pricingConfidence = case when provider_models.pricingConfidence = 'manual_admin_override' then provider_models.pricingConfidence else excluded.pricingConfidence end,
           metadataJson = excluded.metadataJson, updatedAt = CURRENT_TIMESTAMP`,
        [modelId, providerId, externalModelId, String(liveModel.name ?? liveModel.displayName ?? displayNameFromId(externalModelId)), endpointType, Number(liveModel.context_length ?? liveModel.contextWindowTokens) || null,
          JSON.stringify([...tags]), JSON.stringify({ chatCompletions: endpointType === "openai_chat_completions" }), inferred?.isFree ? 1 : 0, inferred?.pricingConfidence ?? before?.pricingConfidence ?? "unknown",
          JSON.stringify({ live: liveModel, sourceUrl: OPENCODE_ZEN_MODELS_URL })],
      );
      const after = await this.findByExternalId(providerId, externalModelId);
      if (inferred && after && after.currentPricing?.pricingConfidence !== "manual_admin_override") await this.upsertCurrentPricing(after.id, inferred.inputUsdPer1M, inferred.outputUsdPer1M, inferred.isFree, inferred.pricingConfidence, OPENCODE_ZEN_MODELS_URL);
    }
    return { fetched: live.length, created, upserted: live.length };
  }

  async upsertLiveModelForTest(input: { id: string; endpointType?: ProviderEndpointType; isFree?: boolean; tags?: string[] }): Promise<ModelCatalogItem> {
    const providerId = await this.ensureOpenCodeProvider();
    const modelId = randomUUID();
    await this.dataSource.query(
      `insert into provider_models (id, providerId, externalModelId, displayName, endpointType, tagsJson, capabilitiesJson, isFree, isEnabled, pricingConfidence, metadataJson)
       values (?, ?, ?, ?, ?, ?, '{}', ?, 1, ?, '{}')`,
      [modelId, providerId, input.id, displayNameFromId(input.id), input.endpointType ?? "openai_chat_completions", JSON.stringify(input.tags ?? []), input.isFree ? 1 : 0, input.isFree ? "live_model_id_inferred" : "unknown"],
    );
    await this.upsertCurrentPricing(modelId, 0, 0, !!input.isFree, input.isFree ? "live_model_id_inferred" : "unknown", OPENCODE_ZEN_MODELS_URL);
    return this.getById(modelId);
  }

  private async ensureOpenCodeProvider(): Promise<string> {
    await this.dataSource.query(
      `insert into providers (id, slug, displayName, baseUrl, isEnabled) values (?, ?, ?, ?, 1)
       on conflict(slug) do update set displayName = excluded.displayName, baseUrl = excluded.baseUrl, isEnabled = 1, updatedAt = CURRENT_TIMESTAMP`,
      [randomUUID(), OPENCODE_ZEN_PROVIDER.slug, OPENCODE_ZEN_PROVIDER.displayName, OPENCODE_ZEN_PROVIDER.baseUrl],
    );
    const rows = (await this.dataSource.query("select id from providers where slug = ?", [OPENCODE_ZEN_PROVIDER.slug])) as Array<{ id: string }>;
    const provider = rows[0];
    if (!provider) throw new Error("OpenCode Zen provider seed failed");
    return provider.id;
  }

  private async upsertCurrentPricing(providerModelId: string, inputUsdPer1M: number, outputUsdPer1M: number, isFree: boolean, pricingConfidence: PricingConfidence, sourceUrl: string): Promise<void> {
    const current = (await this.dataSource.query("select pricingConfidence from model_pricings where providerModelId = ? and effectiveTo is null", [providerModelId])) as Array<{ pricingConfidence: PricingConfidence }>;
    if (current[0]?.pricingConfidence === "manual_admin_override") return;
    await this.dataSource.query("update model_pricings set effectiveTo = CURRENT_TIMESTAMP where providerModelId = ? and effectiveTo is null", [providerModelId]);
    await this.dataSource.query(
      `insert into model_pricings (id, providerModelId, currency, inputUsdPer1M, outputUsdPer1M, cachedReadUsdPer1M, cachedWriteUsdPer1M, isFree, pricingConfidence, sourceUrl, sourceUpdatedAt, effectiveFrom, effectiveTo)
       values (?, ?, 'USD', ?, ?, null, null, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, null)`,
      [randomUUID(), providerModelId, inputUsdPer1M, outputUsdPer1M, isFree ? 1 : 0, pricingConfidence, sourceUrl],
    );
  }

  private async findByExternalId(providerId: string, externalModelId: string): Promise<ModelCatalogItem | null> {
    const rows = await this.list({ provider: OPENCODE_ZEN_PROVIDER.slug });
    return rows.find((model) => model.externalModelId === externalModelId) ?? null;
  }

  private async getById(modelId: string): Promise<ModelCatalogItem> {
    const rows = (await this.dataSource.query(
      `select pm.*, p.slug as providerSlug, p.displayName as providerName,
              mp.inputUsdPer1M, mp.outputUsdPer1M, mp.cachedReadUsdPer1M, mp.cachedWriteUsdPer1M,
              mp.isFree as pricingIsFree, mp.pricingConfidence as pricingConfidenceCurrent, mp.sourceUrl, mp.sourceUpdatedAt
       from provider_models pm join providers p on p.id = pm.providerId
       left join model_pricings mp on mp.providerModelId = pm.id and mp.effectiveTo is null
       where pm.id = ?`, [modelId])) as ModelRow[];
    if (!rows[0]) throw Object.assign(new Error("Model not found"), { statusCode: 404 });
    return rowToItem(rows[0]);
  }
}
