import type { DataSource } from "typeorm";
import type { ProviderEndpointType } from "../entities/ProviderModel.js";
import { ModelCatalogService, type ModelCatalogItem } from "./model-catalog.service.js";
import { ModelGroupService, type ModelGroupPolicy } from "./model-group.service.js";

export type ResolveInput = { teamId: string; requestedModel: string; endpointType: ProviderEndpointType };

export class RouterService {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(input: ResolveInput): Promise<ModelCatalogItem> {
    const catalog = new ModelCatalogService(this.dataSource);
    const concrete = (await catalog.list({ provider: "opencode-zen", enabled: true, deprecated: false })).find(
      (model) => model.externalModelId === input.requestedModel && model.endpointType === input.endpointType,
    );
    if (concrete) return concrete;

    const group = await new ModelGroupService(this.dataSource).get(input.teamId, input.requestedModel);
    if (!group.isEnabled) throw Object.assign(new Error("Model group disabled"), { statusCode: 404, code: "model_group_disabled" });
    const models = await catalog.list({ provider: "opencode-zen", enabled: true, deprecated: false });
    const byId = new Map(models.map((model) => [model.id, model]));
    const policy: ModelGroupPolicy = { ...group.policy, endpointType: group.policy.endpointType ?? input.endpointType };
    const candidates = group.candidates
      .filter((candidate) => candidate.isEnabled)
      .map((candidate) => ({ candidate, model: byId.get(candidate.providerModelId) }))
      .filter((entry): entry is { candidate: typeof group.candidates[number]; model: ModelCatalogItem } => !!entry.model)
      .filter(({ model }) => this.matches(policy, model))
      .sort((a, b) => a.candidate.priority - b.candidate.priority || b.candidate.weight - a.candidate.weight || a.model.externalModelId.localeCompare(b.model.externalModelId));
    const selected = candidates[0]?.model;
    if (!selected) throw Object.assign(new Error("No route candidates available"), { statusCode: 404, code: "no_route_candidate" });
    return selected;
  }

  private matches(policy: ModelGroupPolicy, model: ModelCatalogItem): boolean {
    if (policy.endpointType && model.endpointType !== policy.endpointType) return false;
    if (!model.isEnabled) return false;
    if (!policy.allowDeprecated && model.deprecatedAt) return false;
    if (policy.freeOnly && !model.isFree) return false;
    if (policy.requiredTags?.some((tag) => !model.tags.includes(tag))) return false;
    if (policy.maxInputUsdPer1M !== undefined && (model.currentPricing?.inputUsdPer1M ?? Number.POSITIVE_INFINITY) > policy.maxInputUsdPer1M) return false;
    if (policy.maxOutputUsdPer1M !== undefined && (model.currentPricing?.outputUsdPer1M ?? Number.POSITIVE_INFINITY) > policy.maxOutputUsdPer1M) return false;
    return true;
  }
}
