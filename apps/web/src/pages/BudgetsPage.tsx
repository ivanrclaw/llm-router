import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export type BudgetScopeType = "team" | "user" | "platform_api_key" | "provider_api_key" | "model" | "model_group";

export type BudgetPolicyListItem = {
  id: string;
  scopeType: BudgetScopeType;
  scopeLabel: string;
  dailyBudgetUsdCents?: number | null;
  monthlyBudgetUsdCents?: number | null;
  hardLimit: boolean;
  alertThresholds: number[];
};

function formatUsd(cents: number | null | undefined): string {
  return cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;
}

function scopeLabel(locale: Locale, scopeType: BudgetScopeType): string {
  const labels: Record<BudgetScopeType, string> = {
    team: t(locale, "budgetScopeTeam"),
    user: t(locale, "budgetScopeUser"),
    platform_api_key: t(locale, "budgetScopePlatformApiKey"),
    provider_api_key: t(locale, "budgetScopeProviderKey"),
    model: t(locale, "budgetScopeModel"),
    model_group: t(locale, "budgetScopeModelGroup"),
  };
  return labels[scopeType];
}

export function BudgetsPage({ locale = "en", policies = [] }: { locale?: Locale; policies?: BudgetPolicyListItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(locale, "budgetsTitle")}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "budgetsSubtitle")}</p>
        </div>
        <button className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950" type="button">
          {t(locale, "createBudgetPolicy")}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {policies.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
            {t(locale, "noBudgetPolicies")}
          </p>
        ) : (
          policies.map((policy) => (
            <article key={policy.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{scopeLabel(locale, policy.scopeType)}</p>
                  <h3 className="mt-1 font-medium">{policy.scopeLabel}</h3>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs ${policy.hardLimit ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
                  {policy.hardLimit ? t(locale, "hardLimit") : t(locale, "softAlertOnly")}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                  <dt className="font-medium">{t(locale, "dailyBudget")}</dt>
                  <dd>{t(locale, "dailyBudget")}: {formatUsd(policy.dailyBudgetUsdCents)}</dd>
                </div>
                <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                  <dt className="font-medium">{t(locale, "monthlyBudget")}</dt>
                  <dd>{t(locale, "monthlyBudget")}: {formatUsd(policy.monthlyBudgetUsdCents)}</dd>
                </div>
                <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-900">
                  <dt className="font-medium">{t(locale, "alertThresholds")}</dt>
                  <dd>
                    {t(locale, "alertThresholds")}: {policy.alertThresholds.length > 0 ? policy.alertThresholds.map((threshold) => `${threshold}%`).join(", ") : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
