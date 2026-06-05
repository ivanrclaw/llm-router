import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import { AuditLogService } from "./audit-log.service.js";
import { TeamService } from "./team.service.js";
import { OpenCodeZenAdapter, OPENCODE_ZEN_SLUG } from "../providers/opencode-zen.adapter.js";

type ProviderRow = { id: string; slug: string; displayName: string; baseUrl: string; isEnabled: number | boolean };
type StoredProviderKey = {
  id: string;
  teamId: string;
  providerId: string;
  providerSlug: string;
  providerName: string;
  name: string;
  keyPrefix: string;
  encryptedKey: string;
  priority: number;
  monthlyBudgetUsdCents: number | null;
  dailyBudgetUsdCents: number | null;
  rpmLimit: number | null;
  isEnabled: number | boolean;
  healthStatus: string;
  lastValidatedAt: string | null;
  lastUsedAt: string | null;
  lastErrorAt: string | null;
  lastErrorCode: string | null;
  cooldownUntil: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProviderKeyView = Omit<StoredProviderKey, "encryptedKey" | "isEnabled"> & { isEnabled: boolean };
export type SelectedProviderKey = ProviderKeyView & { plaintextKey: string };

const rpmBuckets = new Map<string, { windowStartMs: number; count: number }>();

function encryptionKey(): Buffer {
  const source = process.env.ENCRYPTION_KEY || "llm-router-local-dev-encryption-key-change-me";
  return createHash("sha256").update(source).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, ciphertextHex] = payload.split(":");
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error("Invalid encrypted secret payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextHex, "hex")), decipher.final()]).toString("utf8");
}

function toView(row: StoredProviderKey): ProviderKeyView {
  const { encryptedKey: _encryptedKey, isEnabled, ...safe } = row;
  return { ...safe, isEnabled: isEnabled === true || isEnabled === 1 };
}

function keyPrefix(key: string): string {
  return key.slice(0, Math.min(8, key.length));
}

function integerOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw Object.assign(new Error("Invalid numeric policy"), { statusCode: 400 });
  return Math.trunc(parsed);
}

function enforceRpm(row: StoredProviderKey): boolean {
  if (!row.rpmLimit || row.rpmLimit < 1) return true;
  const now = Date.now();
  const current = rpmBuckets.get(row.id);
  const sameWindow = !!current && now - current.windowStartMs < 60_000;
  const windowStartMs = sameWindow ? current.windowStartMs : now;
  const count = sameWindow ? current.count + 1 : 1;
  rpmBuckets.set(row.id, { windowStartMs, count });
  return count <= row.rpmLimit;
}

export class ProviderKeyService {
  private readonly teamService: TeamService;
  private readonly auditLogService: AuditLogService;
  private readonly opencodeZenAdapter = new OpenCodeZenAdapter();

  constructor(private readonly dataSource: DataSource) {
    this.teamService = new TeamService(dataSource);
    this.auditLogService = new AuditLogService(dataSource);
  }

  async list(actorUserId: string, teamId: string): Promise<ProviderKeyView[]> {
    await this.teamService.requireRole(actorUserId, teamId, "viewer");
    return (await this.listRows(teamId)).map(toView);
  }

  async create(actorUserId: string, teamId: string, input: Record<string, unknown>): Promise<ProviderKeyView> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    const name = String(input.name ?? "").trim();
    const key = String(input.key ?? "").trim();
    const providerSlug = String(input.providerSlug ?? OPENCODE_ZEN_SLUG).trim();
    if (!name) throw Object.assign(new Error("Provider key name is required"), { statusCode: 400 });
    if (!key) throw Object.assign(new Error("Provider API key is required"), { statusCode: 400 });
    const provider = await this.getProvider(providerSlug);
    const id = randomUUID();
    const prefix = keyPrefix(key);
    await this.dataSource.query(
      `insert into provider_api_keys
       (id, teamId, providerId, name, keyPrefix, encryptedKey, priority, monthlyBudgetUsdCents, dailyBudgetUsdCents, rpmLimit, isEnabled)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        teamId,
        provider.id,
        name,
        prefix,
        encryptSecret(key),
        Number(input.priority ?? 100),
        integerOrNull(input.monthlyBudgetUsdCents),
        integerOrNull(input.dailyBudgetUsdCents),
        integerOrNull(input.rpmLimit),
        input.isEnabled === false ? 0 : 1,
      ],
    );
    await this.auditLogService.record({ teamId, actorUserId, action: "provider_api_key.created", resourceType: "provider_api_key", resourceId: id, metadata: { providerSlug, keyPrefix: prefix } });
    return toView(await this.getById(teamId, id));
  }

  async update(actorUserId: string, teamId: string, keyId: string, input: Record<string, unknown>): Promise<ProviderKeyView> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    const current = await this.getById(teamId, keyId);
    const name = input.name === undefined ? current.name : String(input.name).trim();
    if (!name) throw Object.assign(new Error("Provider key name is required"), { statusCode: 400 });
    await this.dataSource.query(
      `update provider_api_keys set name = ?, priority = ?, monthlyBudgetUsdCents = ?, dailyBudgetUsdCents = ?, rpmLimit = ?, isEnabled = ?, updatedAt = CURRENT_TIMESTAMP where id = ? and teamId = ?`,
      [
        name,
        input.priority === undefined ? current.priority : Number(input.priority),
        input.monthlyBudgetUsdCents === undefined ? current.monthlyBudgetUsdCents : integerOrNull(input.monthlyBudgetUsdCents),
        input.dailyBudgetUsdCents === undefined ? current.dailyBudgetUsdCents : integerOrNull(input.dailyBudgetUsdCents),
        input.rpmLimit === undefined ? current.rpmLimit : integerOrNull(input.rpmLimit),
        input.isEnabled === undefined ? (current.isEnabled ? 1 : 0) : input.isEnabled === false ? 0 : 1,
        keyId,
        teamId,
      ],
    );
    await this.auditLogService.record({ teamId, actorUserId, action: "provider_api_key.updated", resourceType: "provider_api_key", resourceId: keyId });
    return toView(await this.getById(teamId, keyId));
  }

  async revoke(actorUserId: string, teamId: string, keyId: string): Promise<void> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    await this.getById(teamId, keyId);
    await this.dataSource.query("update provider_api_keys set isEnabled = 0, revokedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP where id = ? and teamId = ?", [keyId, teamId]);
    await this.auditLogService.record({ teamId, actorUserId, action: "provider_api_key.revoked", resourceType: "provider_api_key", resourceId: keyId });
  }

  async validate(actorUserId: string, teamId: string, keyId: string): Promise<ProviderKeyView> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    const row = await this.getById(teamId, keyId);
    const result = await this.validatePlaintext(row.providerSlug, decryptSecret(row.encryptedKey));
    const cooldownUntil = result.cooldownSeconds ? new Date(Date.now() + result.cooldownSeconds * 1000).toISOString() : null;
    await this.dataSource.query(
      `update provider_api_keys set healthStatus = ?, lastValidatedAt = CURRENT_TIMESTAMP, lastErrorAt = ?, lastErrorCode = ?, cooldownUntil = ?, updatedAt = CURRENT_TIMESTAMP where id = ? and teamId = ?`,
      [result.status, result.lastErrorCode ? new Date().toISOString() : null, result.lastErrorCode, cooldownUntil, keyId, teamId],
    );
    await this.auditLogService.record({ teamId, actorUserId, action: "provider_api_key.validated", resourceType: "provider_api_key", resourceId: keyId, metadata: { status: result.status, lastErrorCode: result.lastErrorCode } });
    return toView(await this.getById(teamId, keyId));
  }

  async selectUsableKey(input: { teamId: string; providerSlug: string; excludeKeyIds?: string[] }): Promise<SelectedProviderKey | null> {
    const rows = await this.listRows(input.teamId, input.providerSlug);
    const now = Date.now();
    for (const row of rows) {
      if (input.excludeKeyIds?.includes(row.id)) continue;
      if (!(row.isEnabled === true || row.isEnabled === 1)) continue;
      if (row.revokedAt) continue;
      if (row.cooldownUntil && new Date(row.cooldownUntil).getTime() > now) continue;
      if (row.healthStatus === "invalid") continue;
      if (!(await this.isWithinBudgets(row))) continue;
      if (!enforceRpm(row)) continue;
      await this.dataSource.query("update provider_api_keys set lastUsedAt = CURRENT_TIMESTAMP where id = ?", [row.id]);
      return { ...toView(row), plaintextKey: decryptSecret(row.encryptedKey) };
    }
    return null;
  }

  async markProviderFailure(teamId: string, keyId: string, statusCode: number): Promise<void> {
    const healthStatus = statusCode === 429 ? "rate_limited" : statusCode === 401 || statusCode === 403 ? "invalid" : "error";
    const cooldownUntil = statusCode === 429 ? new Date(Date.now() + 300_000).toISOString() : null;
    await this.dataSource.query(
      "update provider_api_keys set healthStatus = ?, lastErrorAt = CURRENT_TIMESTAMP, lastErrorCode = ?, cooldownUntil = ?, updatedAt = CURRENT_TIMESTAMP where id = ? and teamId = ?",
      [healthStatus, `provider_${statusCode}`, cooldownUntil, keyId, teamId],
    );
  }

  private async validatePlaintext(providerSlug: string, plaintextKey: string) {
    if (providerSlug !== OPENCODE_ZEN_SLUG) throw Object.assign(new Error("Unsupported provider"), { statusCode: 400 });
    return this.opencodeZenAdapter.validateKey(plaintextKey);
  }

  private async isWithinBudgets(row: StoredProviderKey): Promise<boolean> {
    if (!row.monthlyBudgetUsdCents && !row.dailyBudgetUsdCents) return true;
    const monthly = row.monthlyBudgetUsdCents
      ? (await this.dataSource.query("select coalesce(sum(costUsdCents), 0) as spent from usage_events where providerApiKeyId = ? and createdAt >= date('now', 'start of month')", [row.id]))[0]?.spent ?? 0
      : 0;
    const daily = row.dailyBudgetUsdCents
      ? (await this.dataSource.query("select coalesce(sum(costUsdCents), 0) as spent from usage_events where providerApiKeyId = ? and createdAt >= date('now')", [row.id]))[0]?.spent ?? 0
      : 0;
    return (!row.monthlyBudgetUsdCents || Number(monthly) < row.monthlyBudgetUsdCents) && (!row.dailyBudgetUsdCents || Number(daily) < row.dailyBudgetUsdCents);
  }

  private async getProvider(slug: string): Promise<ProviderRow> {
    const rows = (await this.dataSource.query("select * from providers where slug = ? and isEnabled = 1", [slug])) as ProviderRow[];
    const provider = rows[0];
    if (!provider) throw Object.assign(new Error("Provider not found"), { statusCode: 404 });
    return provider;
  }

  private async listRows(teamId: string, providerSlug?: string): Promise<StoredProviderKey[]> {
    const params: string[] = [teamId];
    const providerFilter = providerSlug ? "and p.slug = ?" : "";
    if (providerSlug) params.push(providerSlug);
    return (await this.dataSource.query(
      `select pk.*, p.slug as providerSlug, p.displayName as providerName
       from provider_api_keys pk join providers p on p.id = pk.providerId
       where pk.teamId = ? ${providerFilter}
       order by pk.priority asc, pk.createdAt asc`,
      params,
    )) as StoredProviderKey[];
  }

  private async getById(teamId: string, keyId: string): Promise<StoredProviderKey> {
    const rows = (await this.dataSource.query(
      `select pk.*, p.slug as providerSlug, p.displayName as providerName
       from provider_api_keys pk join providers p on p.id = pk.providerId
       where pk.id = ? and pk.teamId = ?`,
      [keyId, teamId],
    )) as StoredProviderKey[];
    const row = rows[0];
    if (!row) throw Object.assign(new Error("Provider key not found"), { statusCode: 404 });
    return row;
  }
}
