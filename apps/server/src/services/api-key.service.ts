import { randomBytes, randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import { sha256 } from "../lib/slug.js";
import { AuditLogService } from "./audit-log.service.js";
import { TeamService } from "./team.service.js";

export type PlatformApiKeyView = {
  id: string;
  teamId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  monthlyBudgetUsdCents: number | null;
  dailyBudgetUsdCents: number | null;
  rateLimitRpm: number | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  key?: string;
};

type StoredKey = {
  id: string;
  teamId: string;
  userId: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopesJson: string;
  monthlyBudgetUsdCents: number | null;
  dailyBudgetUsdCents: number | null;
  rateLimitRpm: number | null;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

const rateLimitBuckets = new Map<string, { windowStartMs: number; count: number }>();

function enforceRateLimit(row: StoredKey): void {
  if (!row.rateLimitRpm || row.rateLimitRpm < 1) return;
  const now = Date.now();
  const current = rateLimitBuckets.get(row.id);
  const windowStartMs = current && now - current.windowStartMs < 60_000 ? current.windowStartMs : now;
  const count = current && now - current.windowStartMs < 60_000 ? current.count + 1 : 1;
  rateLimitBuckets.set(row.id, { windowStartMs, count });
  if (count > row.rateLimitRpm) {
    throw Object.assign(new Error("Rate limit exceeded"), { statusCode: 429, code: "rate_limit_exceeded" });
  }
}


function parseScopes(value: unknown): string[] {
  if (!Array.isArray(value)) return ["models:read", "chat:write"];
  return value.filter((scope): scope is string => typeof scope === "string" && /^[a-z]+:[a-z]+$/.test(scope));
}

function parseOptionalDate(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error("Invalid expiresAt"), { statusCode: 400 });
  return date.toISOString();
}

function viewFromRow(row: StoredKey, key?: string): PlatformApiKeyView {
  return {
    id: row.id,
    teamId: row.teamId,
    userId: row.userId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: JSON.parse(row.scopesJson) as string[],
    monthlyBudgetUsdCents: row.monthlyBudgetUsdCents,
    dailyBudgetUsdCents: row.dailyBudgetUsdCents,
    rateLimitRpm: row.rateLimitRpm,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
    ...(key ? { key } : {}),
  };
}

export class ApiKeyService {
  private readonly teamService: TeamService;
  private readonly auditLogService: AuditLogService;

  constructor(private readonly dataSource: DataSource) {
    this.teamService = new TeamService(dataSource);
    this.auditLogService = new AuditLogService(dataSource);
  }

  async list(actorUserId: string, teamId: string): Promise<PlatformApiKeyView[]> {
    await this.teamService.requireRole(actorUserId, teamId, "viewer");
    const rows = (await this.dataSource.query(
      "select * from platform_api_keys where teamId = ? order by createdAt desc",
      [teamId],
    )) as StoredKey[];
    return rows.map((row) => viewFromRow(row));
  }

  async create(actorUserId: string, teamId: string, input: Record<string, unknown>): Promise<PlatformApiKeyView> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    const name = String(input.name ?? "").trim();
    if (!name) throw Object.assign(new Error("API key name is required"), { statusCode: 400 });
    const key = `lr_${randomBytes(32).toString("base64url")}`;
    const id = randomUUID();
    const keyPrefix = key.slice(0, 12);
    const scopes = parseScopes(input.scopes);
    const expiresAt = parseOptionalDate(input.expiresAt);
    await this.dataSource.query(
      `insert into platform_api_keys
       (id, teamId, userId, name, keyPrefix, keyHash, scopesJson, monthlyBudgetUsdCents, dailyBudgetUsdCents, rateLimitRpm, expiresAt)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        teamId,
        actorUserId,
        name,
        keyPrefix,
        sha256(key),
        JSON.stringify(scopes),
        input.monthlyBudgetUsdCents ?? null,
        input.dailyBudgetUsdCents ?? null,
        input.rateLimitRpm ?? null,
        expiresAt,
      ],
    );
    await this.auditLogService.record({
      teamId,
      actorUserId,
      action: "platform_api_key.created",
      resourceType: "platform_api_key",
      resourceId: id,
      metadata: { keyPrefix, scopes },
    });
    const row = await this.getById(teamId, id);
    return viewFromRow(row, key);
  }

  async update(actorUserId: string, teamId: string, keyId: string, input: Record<string, unknown>): Promise<PlatformApiKeyView> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    const current = await this.getById(teamId, keyId);
    const name = input.name === undefined ? current.name : String(input.name).trim();
    if (!name) throw Object.assign(new Error("API key name is required"), { statusCode: 400 });
    const scopes = input.scopes === undefined ? (JSON.parse(current.scopesJson) as string[]) : parseScopes(input.scopes);
    const expiresAt = input.expiresAt === undefined ? current.expiresAt : parseOptionalDate(input.expiresAt);
    await this.dataSource.query(
      `update platform_api_keys
       set name = ?, scopesJson = ?, monthlyBudgetUsdCents = ?, dailyBudgetUsdCents = ?, rateLimitRpm = ?, expiresAt = ?
       where id = ? and teamId = ?`,
      [
        name,
        JSON.stringify(scopes),
        input.monthlyBudgetUsdCents === undefined ? current.monthlyBudgetUsdCents : input.monthlyBudgetUsdCents,
        input.dailyBudgetUsdCents === undefined ? current.dailyBudgetUsdCents : input.dailyBudgetUsdCents,
        input.rateLimitRpm === undefined ? current.rateLimitRpm : input.rateLimitRpm,
        expiresAt,
        keyId,
        teamId,
      ],
    );
    await this.auditLogService.record({
      teamId,
      actorUserId,
      action: "platform_api_key.updated",
      resourceType: "platform_api_key",
      resourceId: keyId,
      metadata: { scopes },
    });
    return viewFromRow(await this.getById(teamId, keyId));
  }

  async revoke(actorUserId: string, teamId: string, keyId: string): Promise<void> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    await this.getById(teamId, keyId);
    await this.dataSource.query("update platform_api_keys set revokedAt = CURRENT_TIMESTAMP where id = ? and teamId = ?", [keyId, teamId]);
    await this.auditLogService.record({
      teamId,
      actorUserId,
      action: "platform_api_key.revoked",
      resourceType: "platform_api_key",
      resourceId: keyId,
    });
  }

  async authenticate(rawKey: string, requiredScope: string): Promise<StoredKey> {
    const rows = (await this.dataSource.query("select * from platform_api_keys where keyHash = ?", [sha256(rawKey)])) as StoredKey[];
    const row = rows[0];
    const now = Date.now();
    if (!row || row.revokedAt || (row.expiresAt && new Date(row.expiresAt).getTime() <= now)) {
      throw Object.assign(new Error("Invalid API key"), { statusCode: 401, code: "invalid_api_key" });
    }
    const scopes = JSON.parse(row.scopesJson) as string[];
    if (!scopes.includes(requiredScope)) {
      throw Object.assign(new Error("API key lacks required scope"), { statusCode: 403, code: "insufficient_scope" });
    }
    enforceRateLimit(row);
    await this.dataSource.query("update platform_api_keys set lastUsedAt = CURRENT_TIMESTAMP where id = ?", [row.id]);
    return row;
  }

  private async getById(teamId: string, keyId: string): Promise<StoredKey> {
    const rows = (await this.dataSource.query("select * from platform_api_keys where id = ? and teamId = ?", [keyId, teamId])) as StoredKey[];
    const row = rows[0];
    if (!row) throw Object.assign(new Error("API key not found"), { statusCode: 404 });
    return row;
  }
}
