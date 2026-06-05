import { createHash } from "crypto";
import type { DataSource } from "typeorm";
import type { ProviderEndpointType } from "../entities/ProviderModel.js";
import { ModelCatalogService, type ModelCatalogItem } from "./model-catalog.service.js";
import { ModelGroupService, type ModelGroupPolicy } from "./model-group.service.js";
import { SessionAffinityService, type SessionAffinityInput } from "./session-affinity.service.js";

export type ResolveInput = {
  teamId: string;
  requestedModel: string;
  endpointType: ProviderEndpointType;
  platformApiKeyId?: string;
  session?: SessionAffinityInput;
};

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

    const affinity = new SessionAffinityService(this.dataSource);
    const models = await catalog.list({ provider: "opencode-zen", enabled: true, deprecated: false });
    const byId = new Map(models.map((model) => [model.id, model]));
    if (input.platformApiKeyId) {
      const validAffinity = await affinity.findValid({
        teamId: input.teamId,
        platformApiKeyId: input.platformApiKeyId,
        requestedModel: input.requestedModel,
        endpointType: input.endpointType,
        session: input.session,
      });
      const stickyModel = validAffinity ? byId.get(validAffinity.providerModelId) : null;
      if (stickyModel) return stickyModel;
    }

    const policy: ModelGroupPolicy = { ...group.policy, endpointType: group.policy.endpointType ?? input.endpointType };
    const candidates = group.candidates
      .filter((candidate) => candidate.isEnabled)
      .map((candidate) => ({ candidate, model: byId.get(candidate.providerModelId) }))
      .filter((entry): entry is { candidate: typeof group.candidates[number]; model: ModelCatalogItem } => !!entry.model)
      .filter(({ model }) => this.matches(policy, model))
      .sort((a, b) => a.candidate.priority - b.candidate.priority || b.candidate.weight - a.candidate.weight || a.model.externalModelId.localeCompare(b.model.externalModelId));
    const selected = this.selectCandidate(candidates, input.session);
    if (!selected) throw Object.assign(new Error("No route candidates available"), { statusCode: 404, code: "no_route_candidate" });
    if (input.platformApiKeyId) {
      await affinity.store({
        teamId: input.teamId,
        platformApiKeyId: input.platformApiKeyId,
        requestedModel: input.requestedModel,
        session: input.session,
        model: selected,
        ttlSeconds: group.stickySessionTtlSeconds,
      });
    }
    return selected;
  }

  private selectCandidate(
    candidates: Array<{ candidate: { priority: number; weight: number }; model: ModelCatalogItem }>,
    session?: SessionAffinityInput,
  ): ModelCatalogItem | null {
    if (candidates.length === 0) return null;
    const first = candidates[0];
    if (!first) return null;
    const bestPriority = first.candidate.priority;
    const priorityGroup = candidates.filter((entry) => entry.candidate.priority === bestPriority);
    const priorityFirst = priorityGroup[0];
    if (!priorityFirst) return null;
    if (!session || priorityGroup.length === 1) return priorityFirst.model;
    const seed = session.headerSessionId || session.metadataSessionId || session.userId || session.fallbackSeed || "anonymous";
    const totalWeight = priorityGroup.reduce((sum, entry) => sum + Math.max(1, entry.candidate.weight), 0);
    const hash = createHash("sha256").update(String(seed)).digest();
    let slot = hash.readUInt32BE(0) % totalWeight;
    for (const entry of priorityGroup) {
      slot -= Math.max(1, entry.candidate.weight);
      if (slot < 0) return entry.model;
    }
    return priorityFirst.model;
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
