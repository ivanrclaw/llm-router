import { createHash } from "crypto";
import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import type { ProviderEndpointType } from "../entities/ProviderModel.js";
import type { ModelCatalogItem } from "./model-catalog.service.js";

export type SessionAffinityInput = {
  headerSessionId?: string | null;
  metadataSessionId?: string | null;
  userId?: string | null;
  fallbackSeed?: string | null;
};

export type AffinityLookupInput = {
  teamId: string;
  platformApiKeyId: string;
  requestedModel: string;
  session?: SessionAffinityInput;
};

type AffinityRow = {
  id: string;
  teamId: string;
  platformApiKeyId: string;
  requestedModel: string;
  sessionKeyHash: string;
  providerId: string;
  providerModelId: string;
  lastProviderApiKeyId: string | null;
  expiresAt: string;
  hitCount: number;
  failureCount: number;
  isDegraded: number | boolean;
};

export class SessionAffinityService {
  constructor(private readonly dataSource: DataSource) {}

  deriveSessionKey(input?: SessionAffinityInput): string {
    const value = input?.headerSessionId || input?.metadataSessionId || input?.userId || input?.fallbackSeed || "anonymous";
    return String(value);
  }

  hashSessionKey(sessionKey: string): string {
    return createHash("sha256").update(sessionKey).digest("hex");
  }

  async findValid(input: AffinityLookupInput & { endpointType: ProviderEndpointType }): Promise<AffinityRow | null> {
    const sessionKeyHash = this.hashSessionKey(this.deriveSessionKey(input.session));
    const rows = (await this.dataSource.query(
      `select * from session_affinities
       where teamId = ? and platformApiKeyId = ? and requestedModel = ? and sessionKeyHash = ? and expiresAt > CURRENT_TIMESTAMP
       limit 1`,
      [input.teamId, input.platformApiKeyId, input.requestedModel, sessionKeyHash],
    )) as AffinityRow[];
    const affinity = rows[0];
    if (!affinity || affinity.isDegraded === true || affinity.isDegraded === 1) return null;
    const modelRows = await this.dataSource.query(
      `select pm.id
       from provider_models pm join providers p on p.id = pm.providerId
       where pm.id = ? and pm.isEnabled = 1 and p.isEnabled = 1 and pm.deprecatedAt is null and pm.endpointType = ?`,
      [affinity.providerModelId, input.endpointType],
    );
    if (!modelRows[0]) {
      await this.recordFailure({ ...input, sessionKey: this.deriveSessionKey(input.session) });
      return null;
    }
    await this.dataSource.query("update session_affinities set hitCount = hitCount + 1, lastSeenAt = CURRENT_TIMESTAMP where id = ?", [affinity.id]);
    return affinity;
  }

  async store(input: AffinityLookupInput & { model: ModelCatalogItem; ttlSeconds: number; lastProviderApiKeyId?: string | null }): Promise<void> {
    const sessionKeyHash = this.hashSessionKey(this.deriveSessionKey(input.session));
    const expiresAt = new Date(Date.now() + input.ttlSeconds * 1000).toISOString();
    const existing = (await this.dataSource.query(
      "select id, failureCount, isDegraded from session_affinities where teamId = ? and platformApiKeyId = ? and requestedModel = ? and sessionKeyHash = ?",
      [input.teamId, input.platformApiKeyId, input.requestedModel, sessionKeyHash],
    )) as Array<{ id: string; failureCount: number; isDegraded: number | boolean }>;
    if (existing[0]) {
      await this.dataSource.query(
        `update session_affinities
         set providerId = ?, providerModelId = ?, lastProviderApiKeyId = ?, expiresAt = ?, lastSeenAt = CURRENT_TIMESTAMP
         where id = ?`,
        [input.model.providerId, input.model.id, input.lastProviderApiKeyId ?? null, expiresAt, existing[0].id],
      );
      return;
    }
    await this.dataSource.query(
      `insert into session_affinities (id, teamId, platformApiKeyId, requestedModel, sessionKeyHash, providerId, providerModelId, lastProviderApiKeyId, expiresAt)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), input.teamId, input.platformApiKeyId, input.requestedModel, sessionKeyHash, input.model.providerId, input.model.id, input.lastProviderApiKeyId ?? null, expiresAt],
    );
  }

  async recordFailure(input: AffinityLookupInput & { sessionKey?: string }): Promise<void> {
    const sessionKeyHash = this.hashSessionKey(input.sessionKey ?? this.deriveSessionKey(input.session));
    await this.dataSource.query(
      `update session_affinities
       set failureCount = failureCount + 1,
           isDegraded = case when failureCount + 1 >= 3 then 1 else isDegraded end,
           lastSeenAt = CURRENT_TIMESTAMP
       where teamId = ? and platformApiKeyId = ? and requestedModel = ? and sessionKeyHash = ?`,
      [input.teamId, input.platformApiKeyId, input.requestedModel, sessionKeyHash],
    );
  }
}
