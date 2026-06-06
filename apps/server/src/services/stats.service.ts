import type { DataSource } from "typeorm";
import { TeamService } from "./team.service.js";

export type StatsFilters = {
  from?: string;
  to?: string;
  modelId?: string;
  modelGroupId?: string;
  userId?: string;
  platformApiKeyId?: string;
  providerKeyId?: string;
};

type UsageEventRow = {
  requestId: string;
  createdAt: string;
  teamId: string;
  userId: string;
  platformApiKeyId: string;
  providerApiKeyId: string | null;
  providerModelId: string;
  requestedModel: string;
  resolvedModel: string;
  status: string;
  errorCode: string | null;
  httpStatus: number | null;
  promptTokens: number;
  completionTokens: number;
  cachedReadTokens: number;
  cachedWriteTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsdCents: number;
  savedUsdCents: number;
  usageSource: string;
  isStreaming: number | boolean;
};

const numericFields = ["promptTokens", "completionTokens", "cachedReadTokens", "cachedWriteTokens", "totalTokens", "latencyMs", "costUsdCents", "savedUsdCents"] as const;

function numberValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function isoDate(value: string): string {
  return value.slice(0, 10);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export class StatsService {
  private teamService: TeamService;

  constructor(private dataSource: DataSource) {
    this.teamService = new TeamService(dataSource);
  }

  async getStats(actorUserId: string, teamId: string, filters: StatsFilters) {
    await this.teamService.requireRole(actorUserId, teamId, "viewer");
    const rows = await this.fetchRows(teamId, filters);
    const overview = this.summarize(rows);
    const latencies = rows.map((row) => numberValue(row.latencyMs)).filter((value) => value > 0);
    return {
      filters: { teamId, ...filters },
      overview,
      latency: {
        avgLatencyMs: rows.length ? Math.round(rows.reduce((sum, row) => sum + numberValue(row.latencyMs), 0) / rows.length) : 0,
        p50LatencyMs: percentile(latencies, 50),
        p95LatencyMs: percentile(latencies, 95),
      },
      cache: {
        cachedReadTokens: overview.cachedReadTokens,
        cachedWriteTokens: overview.cachedWriteTokens,
        savedUsdCents: overview.savedUsdCents,
        cacheTokenRatio: overview.promptTokens > 0 ? Number(((overview.cachedReadTokens + overview.cachedWriteTokens) / overview.promptTokens).toFixed(4)) : 0,
      },
      errors: this.breakdown(rows.filter((row) => row.status !== "success"), (row) => `${row.errorCode ?? "unknown"}|${row.httpStatus ?? ""}`).map((item) => {
        const [errorCode, httpStatus] = item.id.split("|");
        return { errorCode, count: item.requestCount, httpStatus: httpStatus ? Number(httpStatus) : null };
      }),
      timeSeries: this.timeSeries(rows),
      breakdowns: {
        models: this.breakdown(rows, (row) => row.providerModelId, (row) => row.resolvedModel),
        modelGroups: this.breakdown(rows, (row) => row.requestedModel, (row) => row.requestedModel),
        users: this.breakdown(rows, (row) => row.userId),
        platformApiKeys: this.breakdown(rows, (row) => row.platformApiKeyId),
        providerKeys: this.breakdown(rows.filter((row) => row.providerApiKeyId != null), (row) => row.providerApiKeyId ?? "unknown"),
      },
    };
  }

  async exportCsv(actorUserId: string, teamId: string, filters: StatsFilters): Promise<string> {
    await this.teamService.requireRole(actorUserId, teamId, "viewer");
    const rows = await this.fetchRows(teamId, filters);
    const columns: Array<keyof UsageEventRow> = ["requestId", "createdAt", "status", "errorCode", "httpStatus", "requestedModel", "resolvedModel", "providerModelId", "userId", "platformApiKeyId", "providerApiKeyId", "promptTokens", "completionTokens", "totalTokens", "cachedReadTokens", "cachedWriteTokens", "latencyMs", "costUsdCents", "savedUsdCents", "usageSource", "isStreaming"];
    return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
  }

  private async fetchRows(teamId: string, filters: StatsFilters): Promise<UsageEventRow[]> {
    const clauses = ["teamId = ?"];
    const params: unknown[] = [teamId];
    if (filters.from) { clauses.push("date(createdAt) >= date(?)"); params.push(filters.from); }
    if (filters.to) { clauses.push("date(createdAt) < date(?)"); params.push(filters.to); }
    if (filters.modelId) { clauses.push("providerModelId = ?"); params.push(filters.modelId); }
    if (filters.modelGroupId) { clauses.push("requestedModel = ?"); params.push(filters.modelGroupId); }
    if (filters.userId) { clauses.push("userId = ?"); params.push(filters.userId); }
    if (filters.platformApiKeyId) { clauses.push("platformApiKeyId = ?"); params.push(filters.platformApiKeyId); }
    if (filters.providerKeyId) { clauses.push("providerApiKeyId = ?"); params.push(filters.providerKeyId); }
    return await this.dataSource.query(`select * from usage_events where ${clauses.join(" and ")} order by createdAt asc`, params) as UsageEventRow[];
  }

  private summarize(rows: UsageEventRow[]) {
    const base = { requestCount: rows.length, successCount: 0, errorCount: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedReadTokens: 0, cachedWriteTokens: 0, costUsdCents: 0, savedUsdCents: 0 };
    for (const row of rows) {
      if (row.status === "success") base.successCount += 1; else base.errorCount += 1;
      for (const field of numericFields) if (field !== "latencyMs") base[field] += numberValue(row[field]);
    }
    return base;
  }

  private timeSeries(rows: UsageEventRow[]) {
    const byDate = new Map<string, UsageEventRow[]>();
    for (const row of rows) {
      const date = isoDate(String(row.createdAt));
      byDate.set(date, [...(byDate.get(date) ?? []), row]);
    }
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateRows]) => ({ date, ...this.summarize(dateRows) }));
  }

  private breakdown(rows: UsageEventRow[], idFor: (row: UsageEventRow) => string, labelFor: (row: UsageEventRow) => string = idFor) {
    const byId = new Map<string, { label: string; rows: UsageEventRow[] }>();
    for (const row of rows) {
      const id = idFor(row);
      const current = byId.get(id) ?? { label: labelFor(row), rows: [] };
      current.rows.push(row);
      byId.set(id, current);
    }
    return Array.from(byId.entries()).map(([id, value]) => ({ id, label: value.label, ...this.summarize(value.rows) })).sort((a, b) => b.requestCount - a.requestCount || b.costUsdCents - a.costUsdCents);
  }
}
