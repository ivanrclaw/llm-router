import { randomUUID } from "crypto";
import type { DataSource } from "typeorm";
import { TeamService } from "./team.service.js";
import { usagePeriodKeys } from "./usage.service.js";

export type BudgetScopeType = "team" | "user" | "platform_api_key" | "provider_api_key" | "model" | "model_group";

export type BudgetPolicyView = {
  id: string;
  scopeType: BudgetScopeType;
  scopeId: string;
  monthlyBudgetUsdCents: number | null;
  dailyBudgetUsdCents: number | null;
  hardLimit: boolean;
  alertThresholds: number[];
  createdAt: string;
  updatedAt: string;
};

type BudgetPolicyRow = Omit<BudgetPolicyView, "hardLimit" | "alertThresholds"> & { hardLimit: number | boolean; alertThresholdsJson: string };

function view(row: BudgetPolicyRow): BudgetPolicyView {
  return { ...row, hardLimit: row.hardLimit === true || row.hardLimit === 1, alertThresholds: JSON.parse(row.alertThresholdsJson || "[]") as number[] };
}

function cents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw Object.assign(new Error("Invalid budget amount"), { statusCode: 400, code: "invalid_budget_amount" });
  return Math.round(n);
}

export class BudgetService {
  private readonly teamService: TeamService;
  constructor(private readonly dataSource: DataSource) { this.teamService = new TeamService(dataSource); }

  async list(actorUserId: string, teamId: string): Promise<BudgetPolicyView[]> {
    await this.teamService.requireRole(actorUserId, teamId, "viewer");
    const rows = await this.dataSource.query("select * from budget_policies order by createdAt desc") as BudgetPolicyRow[];
    const visible: BudgetPolicyView[] = [];
    for (const row of rows) {
      try {
        await this.assertScopeBelongsToTeam(teamId, row.scopeType, row.scopeId);
        visible.push(view(row));
      } catch {
        // Ignore policies scoped to other teams or invalid/deleted resources.
      }
    }
    return visible;
  }

  async upsert(actorUserId: string, teamId: string, scopeType: BudgetScopeType, scopeId: string, input: Record<string, unknown>): Promise<BudgetPolicyView> {
    await this.teamService.requireRole(actorUserId, teamId, "admin");
    await this.assertScopeBelongsToTeam(teamId, scopeType, scopeId);
    const existing = await this.dataSource.query("select * from budget_policies where scopeType = ? and scopeId = ?", [scopeType, scopeId]) as BudgetPolicyRow[];
    const id = existing[0]?.id ?? randomUUID();
    const monthlyBudgetUsdCents = input.monthlyBudgetUsdCents === undefined ? existing[0]?.monthlyBudgetUsdCents ?? null : cents(input.monthlyBudgetUsdCents);
    const dailyBudgetUsdCents = input.dailyBudgetUsdCents === undefined ? existing[0]?.dailyBudgetUsdCents ?? null : cents(input.dailyBudgetUsdCents);
    const hardLimit = input.hardLimit === undefined ? (existing[0] ? view(existing[0]).hardLimit : true) : input.hardLimit !== false;
    const alertThresholds = Array.isArray(input.alertThresholds) ? input.alertThresholds.map(Number).filter((n) => Number.isFinite(n) && n > 0) : (existing[0] ? view(existing[0]).alertThresholds : []);
    await this.dataSource.query(
      `insert into budget_policies (id, scopeType, scopeId, monthlyBudgetUsdCents, dailyBudgetUsdCents, hardLimit, alertThresholdsJson)
       values (?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set monthlyBudgetUsdCents = excluded.monthlyBudgetUsdCents, dailyBudgetUsdCents = excluded.dailyBudgetUsdCents, hardLimit = excluded.hardLimit, alertThresholdsJson = excluded.alertThresholdsJson, updatedAt = CURRENT_TIMESTAMP`,
      [id, scopeType, scopeId, monthlyBudgetUsdCents, dailyBudgetUsdCents, hardLimit ? 1 : 0, JSON.stringify(alertThresholds)],
    );
    return this.getById(id);
  }

  async enforce(input: { teamId: string; userId: string; platformApiKeyId: string; providerApiKeyId?: string | null; modelId: string; modelGroupId?: string | null; estimatedCostUsdCents?: number }) {
    const scopes = [
      { scopeType: "team", scopeId: input.teamId },
      { scopeType: "user", scopeId: input.userId },
      { scopeType: "platform_api_key", scopeId: input.platformApiKeyId },
      ...(input.providerApiKeyId ? [{ scopeType: "provider_api_key", scopeId: input.providerApiKeyId }] : []),
      { scopeType: "model", scopeId: input.modelId },
      ...(input.modelGroupId ? [{ scopeType: "model_group", scopeId: input.modelGroupId }] : []),
    ];
    const cost = input.estimatedCostUsdCents ?? 0;
    const { daily, monthly } = usagePeriodKeys();
    for (const scope of scopes) {
      const policies = await this.dataSource.query("select * from budget_policies where scopeType = ? and scopeId = ? and hardLimit = 1", [scope.scopeType, scope.scopeId]) as BudgetPolicyRow[];
      const policy = policies[0];
      if (!policy) continue;
      const dailySpent = await this.ledgerSpent(scope.scopeType, scope.scopeId, "daily", daily);
      const monthlySpent = await this.ledgerSpent(scope.scopeType, scope.scopeId, "monthly", monthly);
      if (policy.dailyBudgetUsdCents !== null && dailySpent + cost >= policy.dailyBudgetUsdCents) throw Object.assign(new Error("Budget exceeded"), { statusCode: 429, code: "budget_exceeded" });
      if (policy.monthlyBudgetUsdCents !== null && monthlySpent + cost >= policy.monthlyBudgetUsdCents) throw Object.assign(new Error("Budget exceeded"), { statusCode: 429, code: "budget_exceeded" });
    }
  }

  async applySpend(input: { teamId: string; userId: string; platformApiKeyId: string; providerApiKeyId?: string | null; modelId: string; modelGroupId?: string | null; costUsdCents: number }) {
    if (input.costUsdCents <= 0) return;
    const scopes = [
      { scopeType: "team", scopeId: input.teamId },
      { scopeType: "user", scopeId: input.userId },
      { scopeType: "platform_api_key", scopeId: input.platformApiKeyId },
      ...(input.providerApiKeyId ? [{ scopeType: "provider_api_key", scopeId: input.providerApiKeyId }] : []),
      { scopeType: "model", scopeId: input.modelId },
      ...(input.modelGroupId ? [{ scopeType: "model_group", scopeId: input.modelGroupId }] : []),
    ];
    const { daily, monthly } = usagePeriodKeys();
    for (const scope of scopes) {
      await this.incrementLedger(scope.scopeType, scope.scopeId, "daily", daily, input.costUsdCents);
      await this.incrementLedger(scope.scopeType, scope.scopeId, "monthly", monthly, input.costUsdCents);
    }
  }

  private async assertScopeBelongsToTeam(teamId: string, scopeType: BudgetScopeType, scopeId: string) {
    let rows: unknown[] = [];
    if (scopeType === "team") rows = await this.dataSource.query("select id from teams where id = ?", [scopeId]);
    if (scopeType === "user") rows = await this.dataSource.query("select userId from team_members where teamId = ? and userId = ? and isActive = 1", [teamId, scopeId]);
    if (scopeType === "platform_api_key") rows = await this.dataSource.query("select id from platform_api_keys where teamId = ? and id = ?", [teamId, scopeId]);
    if (scopeType === "provider_api_key") rows = await this.dataSource.query("select id from provider_api_keys where teamId = ? and id = ?", [teamId, scopeId]);
    if (scopeType === "model") rows = await this.dataSource.query("select id from provider_models where id = ?", [scopeId]);
    if (scopeType === "model_group") rows = await this.dataSource.query("select id from model_groups where (teamId = ? or teamId is null) and id = ?", [teamId, scopeId]);
    if (!rows[0]) throw Object.assign(new Error("Invalid budget scope"), { statusCode: 400, code: "invalid_budget_scope" });
  }

  private async ledgerSpent(scopeType: string, scopeId: string, periodType: string, periodKey: string): Promise<number> {
    const rows = await this.dataSource.query("select spentUsdCents from budget_ledgers where scopeType = ? and scopeId = ? and periodType = ? and periodKey = ?", [scopeType, scopeId, periodType, periodKey]) as Array<{ spentUsdCents: number }>;
    return Number(rows[0]?.spentUsdCents ?? 0);
  }

  private async incrementLedger(scopeType: string, scopeId: string, periodType: string, periodKey: string, amount: number) {
    await this.dataSource.query(
      `insert into budget_ledgers (id, scopeType, scopeId, periodType, periodKey, spentUsdCents)
       values (?, ?, ?, ?, ?, ?)
       on conflict(scopeType, scopeId, periodType, periodKey) do update set spentUsdCents = spentUsdCents + excluded.spentUsdCents, updatedAt = CURRENT_TIMESTAMP`,
      [randomUUID(), scopeType, scopeId, periodType, periodKey, amount],
    );
  }

  private async getById(id: string): Promise<BudgetPolicyView> {
    const rows = await this.dataSource.query("select * from budget_policies where id = ?", [id]) as BudgetPolicyRow[];
    const row = rows[0];
    if (!row) throw Object.assign(new Error("Budget policy not found"), { statusCode: 404, code: "budget_policy_not_found" });
    return view(row);
  }
}
