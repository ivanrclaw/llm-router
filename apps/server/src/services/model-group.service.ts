import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import type { ProviderEndpointType } from "../entities/ProviderModel.js";
import { ModelCatalogService, type ModelCatalogItem } from "./model-catalog.service.js";

export type ModelGroupPolicy = {
  endpointType?: ProviderEndpointType;
  freeOnly?: boolean;
  maxInputUsdPer1M?: number;
  maxOutputUsdPer1M?: number;
  requiredTags?: string[];
  allowDeprecated?: boolean;
};

export type ModelGroupCandidateInput = { providerModelId: string; priority?: number; weight?: number; isEnabled?: boolean; constraints?: Record<string, unknown> };
export type ModelGroupInput = {
  alias: string; displayName: string; description?: string | null; policy?: ModelGroupPolicy; stickySessionTtlSeconds?: number; isEnabled?: boolean; candidates?: ModelGroupCandidateInput[];
};

type GroupRow = { id: string; teamId: string | null; alias: string; displayName: string; description: string | null; policyJson: string; stickySessionTtlSeconds: number; isEnabled: number | boolean; createdAt: string; updatedAt: string };
type CandidateRow = { id: string; modelGroupId: string; providerModelId: string; priority: number; weight: number; isEnabled: number | boolean; constraintsJson: string; externalModelId: string; providerSlug: string; endpointType: ProviderEndpointType; tagsJson: string; isFree: number | boolean; modelIsEnabled: number | boolean; deprecatedAt: string | null; inputUsdPer1M: number | null; outputUsdPer1M: number | null };

export type ModelGroupCandidateView = { id: string; providerModelId: string; externalModelId: string; providerSlug: string; priority: number; weight: number; isEnabled: boolean; constraints: Record<string, unknown>; warnings: string[] };
export type ModelGroupView = { id: string; teamId: string | null; alias: string; displayName: string; description: string | null; policy: ModelGroupPolicy; stickySessionTtlSeconds: number; isEnabled: boolean; createdAt: string; updatedAt: string; candidates: ModelGroupCandidateView[] };

function normalizeAlias(alias: string): string { return alias.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-"); }
function parsePolicy(text: string): ModelGroupPolicy { return JSON.parse(text || "{}"); }
function isEnabled(value: number | boolean): boolean { return value === true || value === 1; }

export class ModelGroupService {
  constructor(private readonly dataSource: DataSource) {}

  async list(teamId: string): Promise<ModelGroupView[]> {
    const rows = (await this.dataSource.query(
      "select * from model_groups where (teamId = ? or teamId is null) order by teamId is not null desc, alias asc",
      [teamId],
    )) as GroupRow[];
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async get(teamId: string, idOrAlias: string): Promise<ModelGroupView> {
    const rows = (await this.dataSource.query(
      "select * from model_groups where (teamId = ? or teamId is null) and (id = ? or alias = ?) order by teamId is not null desc limit 1",
      [teamId, idOrAlias, idOrAlias],
    )) as GroupRow[];
    const row = rows[0];
    if (!row) throw Object.assign(new Error("Model group not found"), { statusCode: 404, code: "model_group_not_found" });
    return this.hydrate(row);
  }

  async create(teamId: string, input: ModelGroupInput): Promise<ModelGroupView> {
    const alias = normalizeAlias(input.alias);
    const policy = input.policy ?? {};
    const candidateWarnings = await this.validateCandidates(policy, input.candidates ?? []);
    const blocking = candidateWarnings.filter((warning) => warning.reasons.length > 0);
    if (blocking.length > 0) throw Object.assign(new Error("Incompatible model group candidate"), { statusCode: 400, code: "incompatible_model_group_candidate", details: blocking });
    const id = randomUUID();
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        "insert into model_groups (id, teamId, alias, displayName, description, policyJson, stickySessionTtlSeconds, isEnabled) values (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, teamId, alias, input.displayName.trim(), input.description ?? null, JSON.stringify(policy), input.stickySessionTtlSeconds ?? 86400, input.isEnabled === false ? 0 : 1],
      );
      for (const candidate of input.candidates ?? []) await manager.query(
        "insert into model_group_candidates (id, modelGroupId, providerModelId, priority, weight, isEnabled, constraintsJson) values (?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), id, candidate.providerModelId, candidate.priority ?? 100, candidate.weight ?? 1, candidate.isEnabled === false ? 0 : 1, JSON.stringify(candidate.constraints ?? {})],
      );
    });
    return this.get(teamId, id);
  }

  async update(teamId: string, groupId: string, input: Partial<ModelGroupInput>): Promise<ModelGroupView> {
    const current = await this.get(teamId, groupId);
    const policy = input.policy ?? current.policy;
    if (input.candidates) {
      const warnings = await this.validateCandidates(policy, input.candidates);
      const blocking = warnings.filter((warning) => warning.reasons.length > 0);
      if (blocking.length > 0) throw Object.assign(new Error("Incompatible model group candidate"), { statusCode: 400, code: "incompatible_model_group_candidate", details: blocking });
    }
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        "update model_groups set alias = ?, displayName = ?, description = ?, policyJson = ?, stickySessionTtlSeconds = ?, isEnabled = ?, updatedAt = CURRENT_TIMESTAMP where id = ? and teamId = ?",
        [input.alias ? normalizeAlias(input.alias) : current.alias, input.displayName ?? current.displayName, input.description === undefined ? current.description : input.description, JSON.stringify(policy), input.stickySessionTtlSeconds ?? current.stickySessionTtlSeconds, input.isEnabled === undefined ? (current.isEnabled ? 1 : 0) : input.isEnabled ? 1 : 0, current.id, teamId],
      );
      if (input.candidates) {
        await manager.query("delete from model_group_candidates where modelGroupId = ?", [current.id]);
        for (const candidate of input.candidates) await manager.query(
          "insert into model_group_candidates (id, modelGroupId, providerModelId, priority, weight, isEnabled, constraintsJson) values (?, ?, ?, ?, ?, ?, ?)",
          [randomUUID(), current.id, candidate.providerModelId, candidate.priority ?? 100, candidate.weight ?? 1, candidate.isEnabled === false ? 0 : 1, JSON.stringify(candidate.constraints ?? {})],
        );
      }
    });
    return this.get(teamId, current.id);
  }

  async delete(teamId: string, groupId: string): Promise<void> {
    const current = await this.get(teamId, groupId);
    if (current.teamId !== teamId) throw Object.assign(new Error("Cannot delete global model group"), { statusCode: 403, code: "global_group_readonly" });
    await this.dataSource.transaction(async (manager) => {
      await manager.query("delete from model_group_candidates where modelGroupId = ?", [current.id]);
      await manager.query("delete from model_groups where id = ? and teamId = ?", [current.id, teamId]);
    });
  }

  async validateCandidates(policy: ModelGroupPolicy, candidates: ModelGroupCandidateInput[]): Promise<Array<{ providerModelId: string; reasons: string[] }>> {
    const catalog = new ModelCatalogService(this.dataSource);
    const models = await catalog.list({});
    const byId = new Map(models.map((model) => [model.id, model]));
    return candidates.map((candidate) => ({ providerModelId: candidate.providerModelId, reasons: this.candidateWarnings(policy, byId.get(candidate.providerModelId)) }));
  }

  async ensureDefaultGroups(teamId: string): Promise<void> {
    const models = await new ModelCatalogService(this.dataSource).list({ provider: "opencode-zen", chatCompatible: true, enabled: true, deprecated: false });
    await this.ensureDefault(teamId, "coding", "Coding", { endpointType: "openai_chat_completions", requiredTags: ["coding"] }, models.filter((model) => model.tags.includes("coding")));
    await this.ensureDefault(teamId, "free-coding", "Free Coding", { endpointType: "openai_chat_completions", requiredTags: ["coding"], freeOnly: true, maxInputUsdPer1M: 0, maxOutputUsdPer1M: 0 }, models.filter((model) => model.tags.includes("coding") && model.isFree));
    await this.ensureDefault(teamId, "cheap", "Cheap", { endpointType: "openai_chat_completions", maxInputUsdPer1M: 0.2 }, models.filter((model) => (model.currentPricing?.inputUsdPer1M ?? 999) <= 0.2));
  }

  private async ensureDefault(teamId: string, alias: string, displayName: string, policy: ModelGroupPolicy, models: ModelCatalogItem[]): Promise<void> {
    const existing = (await this.dataSource.query("select id from model_groups where teamId = ? and alias = ?", [teamId, alias])) as Array<{ id: string }>;
    if (existing[0]) return;
    await this.create(teamId, { alias, displayName, policy, candidates: models.map((model, index) => ({ providerModelId: model.id, priority: (index + 1) * 10, weight: Math.max(1, 10 - index) })) });
  }

  private async hydrate(row: GroupRow): Promise<ModelGroupView> {
    const candidates = (await this.dataSource.query(
      `select mgc.*, pm.externalModelId, p.slug as providerSlug, pm.endpointType, pm.tagsJson, pm.isFree, pm.isEnabled as modelIsEnabled, pm.deprecatedAt,
              mp.inputUsdPer1M, mp.outputUsdPer1M
       from model_group_candidates mgc join provider_models pm on pm.id = mgc.providerModelId join providers p on p.id = pm.providerId
       left join model_pricings mp on mp.providerModelId = pm.id and mp.effectiveTo is null
       where mgc.modelGroupId = ? order by mgc.priority asc, mgc.weight desc, pm.externalModelId asc`,
      [row.id],
    )) as CandidateRow[];
    const policy = parsePolicy(row.policyJson);
    return {
      id: row.id, teamId: row.teamId, alias: row.alias, displayName: row.displayName, description: row.description, policy,
      stickySessionTtlSeconds: Number(row.stickySessionTtlSeconds), isEnabled: isEnabled(row.isEnabled), createdAt: row.createdAt, updatedAt: row.updatedAt,
      candidates: candidates.map((candidate) => ({ id: candidate.id, providerModelId: candidate.providerModelId, externalModelId: candidate.externalModelId, providerSlug: candidate.providerSlug, priority: candidate.priority, weight: candidate.weight, isEnabled: isEnabled(candidate.isEnabled), constraints: JSON.parse(candidate.constraintsJson || "{}"), warnings: this.candidateWarnings(policy, this.rowToModel(candidate)) })),
    };
  }

  private rowToModel(row: CandidateRow): ModelCatalogItem {
    return { id: row.providerModelId, providerSlug: row.providerSlug, providerName: row.providerSlug, externalModelId: row.externalModelId, displayName: row.externalModelId, endpointType: row.endpointType, contextWindowTokens: null, tags: JSON.parse(row.tagsJson || "[]"), capabilities: {}, isFree: isEnabled(row.isFree), isEnabled: isEnabled(row.modelIsEnabled), pricingConfidence: "unknown", metadata: {}, deprecatedAt: row.deprecatedAt, sourceUrl: null, sourceUpdatedAt: null, currentPricing: row.inputUsdPer1M === null ? null : { inputUsdPer1M: Number(row.inputUsdPer1M), outputUsdPer1M: Number(row.outputUsdPer1M ?? 0), cachedReadUsdPer1M: null, cachedWriteUsdPer1M: null, isFree: isEnabled(row.isFree), pricingConfidence: "unknown", sourceUrl: "", sourceUpdatedAt: "" } };
  }

  private candidateWarnings(policy: ModelGroupPolicy, model?: ModelCatalogItem): string[] {
    if (!model) return ["model_not_found"];
    const warnings: string[] = [];
    if (policy.endpointType && model.endpointType !== policy.endpointType) warnings.push("endpoint_incompatible");
    if (!model.isEnabled) warnings.push("model_disabled");
    if (!policy.allowDeprecated && model.deprecatedAt) warnings.push("model_deprecated");
    if (policy.freeOnly && !model.isFree) warnings.push("paid_model_not_allowed");
    if (policy.requiredTags?.some((tag) => !model.tags.includes(tag))) warnings.push("missing_required_tag");
    if (policy.maxInputUsdPer1M !== undefined && (model.currentPricing?.inputUsdPer1M ?? Number.POSITIVE_INFINITY) > policy.maxInputUsdPer1M) warnings.push("input_cost_too_high");
    if (policy.maxOutputUsdPer1M !== undefined && (model.currentPricing?.outputUsdPer1M ?? Number.POSITIVE_INFINITY) > policy.maxOutputUsdPer1M) warnings.push("output_cost_too_high");
    return warnings;
  }
}
