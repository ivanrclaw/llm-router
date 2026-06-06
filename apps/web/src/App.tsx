import { TeamSwitcher } from "./components/TeamSwitcher";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ProviderKeysPage } from "./pages/ProviderKeysPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ModelGroupsPage } from "./pages/ModelGroupsPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { StatsPage } from "./pages/StatsPage";
import { t, type Locale } from "./lib/i18n";
import { LoginPage, RegisterPage } from "./pages/AuthPages";

export function App({ locale = "en" }: { locale?: Locale }) {
  return (
    <div className="min-h-screen bg-neutral-50 p-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">LLM Router</h1>
          <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">{t(locale, "appSubtitle")}</p>
        </div>
        <a href="/api/health" className="rounded-lg bg-neutral-100 px-4 py-2 text-sm transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
          {t(locale, "healthCheck")}
        </a>
      </header>

      <main className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-2">
        <LoginPage locale={locale} />
        <RegisterPage locale={locale} />
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <TeamSwitcher
            locale={locale}
            teams={[{ id: "demo", name: "Demo Team", role: "owner" }]}
            selectedTeamId="demo"
          />
        </div>
        <div className="lg:col-span-2">
          <ApiKeysPage locale={locale} apiKeys={[{ id: "demo-key", name: "Demo key", keyPrefix: "lr_demo1234", scopes: ["models:read"] }]} />
        </div>
        <div className="lg:col-span-2">
          <ProviderKeysPage locale={locale} providerKeys={[{ id: "demo-provider-key", providerSlug: "opencode-zen", providerName: "OpenCode Zen", name: "Demo Zen key", keyPrefix: "oz_demo_", priority: 10, rpmLimit: 60, isEnabled: true, healthStatus: "unknown" }]} />
        </div>
        <div className="lg:col-span-2">
          <ModelsPage locale={locale} models={[{ id: "demo-model", providerSlug: "opencode-zen", externalModelId: "big-pickle", displayName: "Big Pickle", endpointType: "openai_chat_completions", tags: ["free", "coding"], isFree: true, isEnabled: true, pricingConfidence: "docs_pricing_verified", currentPricing: { inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: true } }]} />
        </div>
        <div className="lg:col-span-2">
          <ModelGroupsPage locale={locale} groups={[{ id: "demo-group", alias: "free-coding", displayName: "Free Coding", isEnabled: true, stickySessionTtlSeconds: 86400, policy: { endpointType: "openai_chat_completions", freeOnly: true, requiredTags: ["coding"] }, candidates: [{ id: "demo-candidate", externalModelId: "big-pickle", providerSlug: "opencode-zen", priority: 10, weight: 3, isEnabled: true, warnings: [] }] }]} />
        </div>
        <div className="lg:col-span-2">
          <BudgetsPage locale={locale} policies={[{ id: "demo-budget", scopeType: "team", scopeLabel: "Demo Team", dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] }]} />
        </div>
        <div className="lg:col-span-2">
          <StatsPage
            locale={locale}
            teamId="demo"
            stats={{
              filters: { teamId: "demo", from: "2026-06-01", to: "2026-06-03" },
              overview: { requestCount: 4, successCount: 3, errorCount: 1, promptTokens: 400, completionTokens: 200, totalTokens: 600, cachedReadTokens: 600, cachedWriteTokens: 300, costUsdCents: 600, savedUsdCents: 120 },
              latency: { avgLatencyMs: 25, p50LatencyMs: 20, p95LatencyMs: 40 },
              cache: { cachedReadTokens: 600, cachedWriteTokens: 300, savedUsdCents: 120, cacheTokenRatio: 2.25 },
              errors: [{ errorCode: "provider_rate_limited", count: 1, httpStatus: 429 }],
              timeSeries: [{ date: "2026-06-01", requestCount: 1, costUsdCents: 100, savedUsdCents: 20 }, { date: "2026-06-02", requestCount: 3, costUsdCents: 500, savedUsdCents: 100 }],
              breakdowns: {
                models: [{ id: "demo-model", label: "big-pickle", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
                modelGroups: [{ id: "free-coding", label: "free-coding", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
                users: [{ id: "demo-user", label: "demo@example.com", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
                platformApiKeys: [{ id: "demo-key", label: "Demo key", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
                providerKeys: [{ id: "demo-provider-key", label: "Demo Zen key", requestCount: 4, costUsdCents: 600, savedUsdCents: 120 }],
              },
            }}
          />
        </div>
      </main>
    </div>
  );
}
