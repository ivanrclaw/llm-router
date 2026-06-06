import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import type { ModelCatalogItem } from "./model-catalog.service.js";

export type UsageStatus = "success" | "error";
export type UsageSource = "provider" | "estimated" | "unavailable";

export type ProviderUsagePayload = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number; cache_read_tokens?: number; cache_creation_tokens?: number };
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type UsageRecordInput = {
  teamId: string;
  userId: string;
  platformApiKeyId: string;
  providerId: string;
  providerApiKeyId: string | null;
  model: ModelCatalogItem;
  requestedModel: string;
  sessionKeyHash?: string | null;
  status: UsageStatus;
  errorCode?: string | null;
  httpStatus?: number | null;
  usage?: ProviderUsagePayload | null;
  promptTextForEstimate?: string | null;
  latencyMs?: number;
  isStreaming?: boolean;
};

function numberFrom(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

function periodKeys(now = new Date()) {
  const iso = now.toISOString();
  return { daily: iso.slice(0, 10), monthly: iso.slice(0, 7) };
}

export class UsageService {
  constructor(private readonly dataSource: DataSource) {}

  computeUsage(input: { usage?: ProviderUsagePayload | null; promptTextForEstimate?: string | null }) {
    const usage = input.usage;
    if (usage) {
      const promptTokens = numberFrom(usage.prompt_tokens ?? usage.input_tokens);
      const completionTokens = numberFrom(usage.completion_tokens ?? usage.output_tokens);
      const cachedReadTokens = numberFrom(usage.prompt_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cache_read_tokens ?? usage.cache_read_input_tokens);
      const cachedWriteTokens = numberFrom(usage.prompt_tokens_details?.cache_creation_tokens ?? usage.cache_creation_input_tokens);
      return {
        promptTokens,
        completionTokens,
        totalTokens: numberFrom(usage.total_tokens) || promptTokens + completionTokens,
        cachedReadTokens,
        cachedWriteTokens,
        usageSource: "provider" as UsageSource,
      };
    }
    const promptTokens = estimateTokens(input.promptTextForEstimate);
    return { promptTokens, completionTokens: 0, totalTokens: promptTokens, cachedReadTokens: 0, cachedWriteTokens: 0, usageSource: promptTokens > 0 ? "estimated" as UsageSource : "unavailable" as UsageSource };
  }

  computeCost(model: ModelCatalogItem, tokens: { promptTokens: number; completionTokens: number; cachedReadTokens: number; cachedWriteTokens: number }) {
    const pricing = model.currentPricing;
    if (!pricing || pricing.isFree || model.isFree) return { costUsdCents: 0, savedUsdCents: 0 };
    const billablePromptTokens = Math.max(0, tokens.promptTokens - tokens.cachedReadTokens - tokens.cachedWriteTokens);
    const inputCost = billablePromptTokens / 1_000_000 * pricing.inputUsdPer1M;
    const outputCost = tokens.completionTokens / 1_000_000 * pricing.outputUsdPer1M;
    const cachedReadCost = tokens.cachedReadTokens / 1_000_000 * (pricing.cachedReadUsdPer1M ?? pricing.inputUsdPer1M);
    const cachedWriteCost = tokens.cachedWriteTokens / 1_000_000 * (pricing.cachedWriteUsdPer1M ?? pricing.inputUsdPer1M);
    const uncachedCacheCost = (tokens.cachedReadTokens + tokens.cachedWriteTokens) / 1_000_000 * pricing.inputUsdPer1M;
    return {
      costUsdCents: Math.round((inputCost + outputCost + cachedReadCost + cachedWriteCost) * 100),
      savedUsdCents: Math.max(0, Math.round((uncachedCacheCost - cachedReadCost - cachedWriteCost) * 100)),
    };
  }

  async record(input: UsageRecordInput) {
    const usage = this.computeUsage({ usage: input.usage, promptTextForEstimate: input.promptTextForEstimate });
    const cost = input.status === "success" ? await this.computeCostWithSavings(input.model, usage) : { costUsdCents: 0, savedUsdCents: 0, baselineModelId: null as string | null };
    const requestId = randomUUID();
    await this.dataSource.query(
      `insert into usage_events (id, requestId, teamId, userId, platformApiKeyId, providerId, providerApiKeyId, providerModelId, requestedModel, resolvedModel, sessionKeyHash, status, errorCode, httpStatus, promptTokens, completionTokens, cachedReadTokens, cachedWriteTokens, totalTokens, latencyMs, costUsdCents, savedUsdCents, baselineModelId, usageSource, isStreaming)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), requestId, input.teamId, input.userId, input.platformApiKeyId, input.providerId, input.providerApiKeyId, input.model.id, input.requestedModel, input.model.externalModelId, input.sessionKeyHash ?? null, input.status, input.errorCode ?? null, input.httpStatus ?? null, usage.promptTokens, usage.completionTokens, usage.cachedReadTokens, usage.cachedWriteTokens, usage.totalTokens, input.latencyMs ?? 0, cost.costUsdCents, cost.savedUsdCents, cost.baselineModelId, usage.usageSource, input.isStreaming ? 1 : 0],
    );
    await this.updateDailyAggregate({ ...input, ...usage, ...cost });
    return { requestId, ...usage, ...cost };
  }

  private async computeCostWithSavings(model: ModelCatalogItem, tokens: { promptTokens: number; completionTokens: number; cachedReadTokens: number; cachedWriteTokens: number }) {
    const cost = this.computeCost(model, tokens);
    const baseline = await this.getBaselineModel();
    if (!baseline || baseline.id === model.id) return { ...cost, baselineModelId: null as string | null };
    const baselineCost = this.computeCost(baseline, tokens).costUsdCents;
    return { costUsdCents: cost.costUsdCents, savedUsdCents: Math.max(cost.savedUsdCents, baselineCost - cost.costUsdCents), baselineModelId: baseline.id };
  }

  private async getBaselineModel(): Promise<ModelCatalogItem | null> {
    const rows = (await this.dataSource.query("select valueJson from system_settings where key = 'usage.baselineModelId'")) as Array<{ valueJson: string }>;
    const raw = rows[0]?.valueJson;
    if (!raw) return null;
    let modelId: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { modelId?: unknown };
      modelId = typeof parsed.modelId === "string" ? parsed.modelId : null;
    } catch {
      modelId = null;
    }
    if (!modelId) return null;
    const modelRows = (await this.dataSource.query(
      `select pm.*, p.slug as providerSlug, p.displayName as providerName,
              mp.inputUsdPer1M, mp.outputUsdPer1M, mp.cachedReadUsdPer1M, mp.cachedWriteUsdPer1M,
              mp.isFree as pricingIsFree, mp.pricingConfidence as pricingConfidenceCurrent, mp.sourceUrl, mp.sourceUpdatedAt
       from provider_models pm join providers p on p.id = pm.providerId
       left join model_pricings mp on mp.providerModelId = pm.id and mp.effectiveTo is null
       where pm.id = ?`,
      [modelId],
    )) as Array<Record<string, unknown>>;
    const row = modelRows[0];
    if (!row) return null;
    return {
      id: String(row.id),
      providerId: String(row.providerId),
      providerSlug: String(row.providerSlug),
      providerName: String(row.providerName),
      externalModelId: String(row.externalModelId),
      displayName: String(row.displayName),
      endpointType: row.endpointType as ModelCatalogItem["endpointType"],
      contextWindowTokens: row.contextWindowTokens === null ? null : Number(row.contextWindowTokens),
      tags: JSON.parse(String(row.tagsJson ?? "[]")) as string[],
      capabilities: JSON.parse(String(row.capabilitiesJson ?? "{}")) as Record<string, unknown>,
      isFree: row.isFree === true || row.isFree === 1,
      isEnabled: row.isEnabled === true || row.isEnabled === 1,
      pricingConfidence: row.pricingConfidence as ModelCatalogItem["pricingConfidence"],
      metadata: JSON.parse(String(row.metadataJson ?? "{}")) as Record<string, unknown>,
      deprecatedAt: row.deprecatedAt === null ? null : String(row.deprecatedAt),
      sourceUrl: row.sourceUrl === null ? null : String(row.sourceUrl),
      sourceUpdatedAt: row.sourceUpdatedAt === null ? null : String(row.sourceUpdatedAt),
      currentPricing: row.inputUsdPer1M === null || row.inputUsdPer1M === undefined ? null : {
        inputUsdPer1M: Number(row.inputUsdPer1M),
        outputUsdPer1M: Number(row.outputUsdPer1M ?? 0),
        cachedReadUsdPer1M: row.cachedReadUsdPer1M === null ? null : Number(row.cachedReadUsdPer1M),
        cachedWriteUsdPer1M: row.cachedWriteUsdPer1M === null ? null : Number(row.cachedWriteUsdPer1M),
        isFree: row.pricingIsFree === true || row.pricingIsFree === 1,
        pricingConfidence: row.pricingConfidenceCurrent as ModelCatalogItem["pricingConfidence"],
        sourceUrl: String(row.sourceUrl ?? ""),
        sourceUpdatedAt: String(row.sourceUpdatedAt ?? ""),
      },
    };
  }

  private async updateDailyAggregate(input: UsageRecordInput & ReturnType<UsageService["computeUsage"]> & { costUsdCents: number; savedUsdCents: number }) {
    const date = periodKeys().daily;
    const existing = await this.dataSource.query(
      `select id, requestCount, avgLatencyMs from usage_daily_aggregates
       where date = ? and teamId = ? and userId = ? and platformApiKeyId = ? and modelId = ? and providerApiKeyId ${input.providerApiKeyId ? "= ?" : "is null"}`,
      input.providerApiKeyId ? [date, input.teamId, input.userId, input.platformApiKeyId, input.model.id, input.providerApiKeyId] : [date, input.teamId, input.userId, input.platformApiKeyId, input.model.id],
    ) as Array<{ id: string; requestCount: number; avgLatencyMs: number }>;
    const current = existing[0];
    if (!current) {
      await this.dataSource.query(
        `insert into usage_daily_aggregates (id, date, teamId, userId, platformApiKeyId, modelId, providerApiKeyId, requestCount, successCount, errorCount, promptTokens, completionTokens, cachedReadTokens, cachedWriteTokens, costUsdCents, savedUsdCents, avgLatencyMs, p50LatencyMs, p95LatencyMs)
         values (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), date, input.teamId, input.userId, input.platformApiKeyId, input.model.id, input.providerApiKeyId, input.status === "success" ? 1 : 0, input.status === "error" ? 1 : 0, input.promptTokens, input.completionTokens, input.cachedReadTokens, input.cachedWriteTokens, input.costUsdCents, input.savedUsdCents, input.latencyMs ?? 0, input.latencyMs ?? 0, input.latencyMs ?? 0],
      );
      return;
    }
    const latency = input.latencyMs ?? 0;
    const avgLatencyMs = Math.round(((current.avgLatencyMs ?? 0) * current.requestCount + latency) / (current.requestCount + 1));
    await this.dataSource.query(
      `update usage_daily_aggregates set requestCount = requestCount + 1, successCount = successCount + ?, errorCount = errorCount + ?, promptTokens = promptTokens + ?, completionTokens = completionTokens + ?, cachedReadTokens = cachedReadTokens + ?, cachedWriteTokens = cachedWriteTokens + ?, costUsdCents = costUsdCents + ?, savedUsdCents = savedUsdCents + ?, avgLatencyMs = ?, p50LatencyMs = ?, p95LatencyMs = ? where id = ?`,
      [input.status === "success" ? 1 : 0, input.status === "error" ? 1 : 0, input.promptTokens, input.completionTokens, input.cachedReadTokens, input.cachedWriteTokens, input.costUsdCents, input.savedUsdCents, avgLatencyMs, latency, latency, current.id],
    );
  }
}

export const usagePeriodKeys = periodKeys;
