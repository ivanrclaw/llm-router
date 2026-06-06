import { useEffect, useState } from "react";
import { TeamSwitcher } from "./components/TeamSwitcher";
import { Button, Card, Skeleton, ToastViewport } from "./components/ui";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ProviderKeysPage } from "./pages/ProviderKeysPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ModelGroupsPage } from "./pages/ModelGroupsPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { StatsPage } from "./pages/StatsPage";
import { t, type Locale } from "./lib/i18n";
import { LoginPage, RegisterPage } from "./pages/AuthPages";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function DashboardDocs({ locale }: { locale: Locale }) {
  const snippets = [
    {
      title: t(locale, "curlExample"),
      body: t(locale, "curlSnippet"),
    },
    {
      title: t(locale, "openAiSdkExample"),
      body: t(locale, "openAiSdkSnippet"),
    },
    {
      title: t(locale, "openCodeExample"),
      body: t(locale, "openCodeSnippet"),
    },
    {
      title: t(locale, "genericAgentsExample"),
      body: t(locale, "genericAgentsSnippet"),
    },
  ];

  return (
    <Card id="docs">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t(locale, "dashboardOverview")}</p>
        <h2 className="mt-1 text-2xl font-semibold">{t(locale, "docsTitle")}</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "docsSubtitle")}</p>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {snippets.map((snippet) => (
          <article key={snippet.title} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h3 className="text-sm font-semibold">{snippet.title}</h3>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-950 p-3 text-xs text-neutral-50"><code>{snippet.body}</code></pre>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <article className="rounded-xl border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
          <h3 className="text-sm font-semibold">{t(locale, "loadingStates")}</h3>
          <div className="mt-3 space-y-2" aria-hidden="true">
            <Skeleton className="h-3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "loadingStateNote")}</p>
        </article>
        <article className="rounded-xl border border-dashed border-red-300 p-4 dark:border-red-900">
          <h3 className="text-sm font-semibold">{t(locale, "confirmations")}</h3>
          <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "destructiveConfirmNote")}</p>
        </article>
        <article className="rounded-xl border border-dashed border-emerald-300 p-4 dark:border-emerald-900">
          <h3 className="text-sm font-semibold">{t(locale, "mutationToasts")}</h3>
          <ToastViewport>
            {t(locale, "toastMutationNote")}
          </ToastViewport>
        </article>
      </div>
    </Card>
  );
}

export function App({ locale = "en" }: { locale?: Locale }) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const [theme, setTheme] = useState<Theme>(() => initialTheme());

  useEffect(() => {
    setActiveLocale(locale);
  }, [locale]);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const themeLabel = theme === "dark" ? t(activeLocale, "switchToLightMode") : t(activeLocale, "switchToDarkMode");
  const navItems = [
    { href: "#api-keys", label: t(activeLocale, "apiKeysTitle") },
    { href: "#provider-keys", label: t(activeLocale, "providerKeysTitle") },
    { href: "#models", label: t(activeLocale, "modelsTitle") },
    { href: "#model-groups", label: t(activeLocale, "modelGroupsTitle") },
    { href: "#budgets", label: t(activeLocale, "budgetsTitle") },
    { href: "#stats", label: t(activeLocale, "statsTitle") },
    { href: "#docs", label: t(activeLocale, "docsTitle") },
  ];

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="grid min-h-screen lg:grid-cols-[18rem_1fr]">
        <aside className="border-b border-neutral-200 bg-white/85 p-5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/85 lg:border-b-0 lg:border-r">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">LLM</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">LLM Router</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(activeLocale, "appSubtitle")}</p>
          </div>
          <nav aria-label={t(activeLocale, "primaryNavigation")} className="mt-8 space-y-2">
            {navItems.map((item) => (
              <a key={item.href} className="block rounded-xl px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900" href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <nav aria-label={t(activeLocale, "breadcrumb")} className="text-sm text-neutral-500">
                  {t(activeLocale, "dashboard")} / {t(activeLocale, "statsTitle")}
                </nav>
                <p className="mt-1 text-xl font-semibold">{t(activeLocale, "dashboardOverview")}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
                <TeamSwitcher
                  locale={activeLocale}
                  teams={[{ id: "demo", name: "Demo Team", role: "owner" }]}
                  selectedTeamId="demo"
                />
                <label className="flex flex-col gap-1 text-sm font-medium">
                  {t(activeLocale, "language")}
                  <select aria-label={t(activeLocale, "language")} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" value={activeLocale} onChange={(event) => setActiveLocale(event.target.value as Locale)}>
                    <option value="en">{t(activeLocale, "english")}</option>
                    <option value="es">{t(activeLocale, "spanish")}</option>
                  </select>
                </label>
                <Button className="px-3" variant="secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  {themeLabel}
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <LoginPage locale={activeLocale} />
              <RegisterPage locale={activeLocale} />
            </div>
            <section id="api-keys"><ApiKeysPage locale={activeLocale} apiKeys={[{ id: "demo-key", name: "Demo key", keyPrefix: "lr_demo1234", scopes: ["models:read"] }]} /></section>
            <section id="provider-keys"><ProviderKeysPage locale={activeLocale} providerKeys={[{ id: "demo-provider-key", providerSlug: "opencode-zen", providerName: "OpenCode Zen", name: "Demo Zen key", keyPrefix: "oz_demo_", priority: 10, rpmLimit: 60, isEnabled: true, healthStatus: "unknown" }]} /></section>
            <section id="models"><ModelsPage locale={activeLocale} models={[{ id: "demo-model", providerSlug: "opencode-zen", externalModelId: "big-pickle", displayName: "Big Pickle", endpointType: "openai_chat_completions", tags: ["free", "coding"], isFree: true, isEnabled: true, pricingConfidence: "docs_pricing_verified", currentPricing: { inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: true } }]} /></section>
            <section id="model-groups"><ModelGroupsPage locale={activeLocale} groups={[{ id: "demo-group", alias: "free-coding", displayName: "Free Coding", isEnabled: true, stickySessionTtlSeconds: 86400, policy: { endpointType: "openai_chat_completions", freeOnly: true, requiredTags: ["coding"] }, candidates: [{ id: "demo-candidate", externalModelId: "big-pickle", providerSlug: "opencode-zen", priority: 10, weight: 3, isEnabled: true, warnings: [] }] }]} /></section>
            <section id="budgets"><BudgetsPage locale={activeLocale} policies={[{ id: "demo-budget", scopeType: "team", scopeLabel: "Demo Team", dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] }]} /></section>
            <section id="stats">
              <StatsPage
                locale={activeLocale}
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
            </section>
            <DashboardDocs locale={activeLocale} />
          </main>
        </div>
      </div>
    </div>
  );
}
