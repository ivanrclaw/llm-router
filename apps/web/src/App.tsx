import { useEffect, useMemo, useState } from "react";
import { TeamSwitcher } from "./components/TeamSwitcher";
import { Button, Card, Skeleton, ToastViewport } from "./components/ui";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { ProviderKeysPage } from "./pages/ProviderKeysPage";
import { ModelsPage } from "./pages/ModelsPage";
import { ModelGroupsPage } from "./pages/ModelGroupsPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { StatsPage } from "./pages/StatsPage";
import { t, type Locale, type TranslationKey } from "./lib/i18n";
import { LoginPage, RegisterPage } from "./pages/AuthPages";

type Theme = "light" | "dark";
type AppProps = { locale?: Locale; initialRoute?: string };

type NavItem = {
  href: string;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: string;
};

type NavSection = {
  titleKey: TranslationKey;
  items: NavItem[];
};

const dashboardNav: NavSection[] = [
  {
    titleKey: "navAnalyze",
    items: [
      { href: "#overview", labelKey: "navOverview", descriptionKey: "navOverviewDescription", icon: "⌁" },
      { href: "#stats", labelKey: "navUsage", descriptionKey: "navUsageDescription", icon: "↗" },
      { href: "#models", labelKey: "navModels", descriptionKey: "navModelsDescription", icon: "◎" },
    ],
  },
  {
    titleKey: "navOperate",
    items: [
      { href: "#model-groups", labelKey: "navModelGroups", descriptionKey: "navModelGroupsDescription", icon: "⇄" },
      { href: "#api-keys", labelKey: "navPlatformKeys", descriptionKey: "navPlatformKeysDescription", icon: "⎇" },
      { href: "#provider-keys", labelKey: "navProviderKeys", descriptionKey: "navProviderKeysDescription", icon: "◆" },
    ],
  },
  {
    titleKey: "navSecure",
    items: [
      { href: "#budgets", labelKey: "navBudgets", descriptionKey: "navBudgetsDescription", icon: "◇" },
    ],
  },
  {
    titleKey: "navResources",
    items: [
      { href: "#docs", labelKey: "navDocs", descriptionKey: "navDocsDescription", icon: "{}" },
    ],
  },
];

const overviewCards = [
  { value: "4", labelKey: "requests", detailKey: "overviewRequestsDetail" },
  { value: "$6.00", labelKey: "cost", detailKey: "overviewCostDetail" },
  { value: "$1.20", labelKey: "savings", detailKey: "overviewSavingsDetail" },
  { value: "40ms", labelKey: "p95Latency", detailKey: "overviewLatencyDetail" },
] as const;

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

function currentRoute(initialRoute?: string) {
  if (initialRoute) return initialRoute;
  if (typeof window === "undefined") return "/";
  return window.location.pathname;
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
    <Card id="docs" className="scroll-mt-24">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t(locale, "navResources")}</p>
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

function AuthView({ locale, route, setLocale, theme, toggleTheme }: { locale: Locale; route: string; setLocale: (locale: Locale) => void; theme: Theme; toggleTheme: () => void }) {
  const isRegister = route === "/register";
  const themeLabel = theme === "dark" ? t(locale, "switchToLightMode") : t(locale, "switchToDarkMode");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_32%),linear-gradient(135deg,_#f8fafc,_#eef2ff)] text-neutral-950 dark:bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.22),_transparent_34%),linear-gradient(135deg,_#020617,_#0a0a0a)] dark:text-neutral-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a href="/" className="flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-bold text-white shadow-lg dark:bg-white dark:text-neutral-950">LR</span>
          <span>
            <span className="block text-sm font-semibold">LLM Router</span>
            <span className="text-xs text-neutral-500">{t(locale, "authProductPill")}</span>
          </span>
        </a>
        <div className="flex items-center gap-2">
          <select aria-label={t(locale, "language")} className="rounded-lg border border-neutral-300 bg-white/80 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="en">{t(locale, "english")}</option>
            <option value="es">{t(locale, "spanish")}</option>
          </select>
          <Button variant="secondary" onClick={toggleTheme}>{themeLabel}</Button>
        </div>
      </header>
      <main aria-label={t(locale, "authentication")} className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-10 px-6 pb-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="max-w-2xl">
          <p className="inline-flex rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">{t(locale, "authProductPill")}</p>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">{t(locale, "authHeroTitle")}</h1>
          <p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{t(locale, "authHeroSubtitle")}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["authBenefitRouting", "authBenefitBudgets", "authBenefitAudit"].map((key) => (
              <div key={key} className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
                {t(locale, key as TranslationKey)}
              </div>
            ))}
          </div>
        </section>
        <section className="justify-self-center lg:justify-self-end">
          {isRegister ? <RegisterPage locale={locale} /> : <LoginPage locale={locale} />}
          <p className="mt-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {isRegister ? t(locale, "alreadyHaveAccount") : t(locale, "needAccount")} {" "}
            <a className="font-semibold text-neutral-950 underline underline-offset-4 dark:text-white" href={isRegister ? "/login" : "/register"}>
              {isRegister ? t(locale, "signIn") : t(locale, "createAccount")}
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}

function Sidebar({ locale }: { locale: Locale }) {
  return (
    <aside className="border-b border-neutral-200 bg-white/90 p-5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">LLM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">LLM Router</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "appSubtitle")}</p>
      </div>
      <nav aria-label={t(locale, "primaryNavigation")} className="mt-8 space-y-6">
        {dashboardNav.map((section) => (
          <section key={section.titleKey} aria-labelledby={`sidebar-${section.titleKey}`}>
            <h2 id={`sidebar-${section.titleKey}`} className="px-2 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
              {t(locale, section.titleKey)}
            </h2>
            <div className="mt-2 space-y-1">
              {section.items.map((item) => (
                <a key={item.href} className="group flex items-start gap-3 rounded-2xl px-3 py-3 text-sm transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-ring dark:hover:bg-neutral-900" href={item.href}>
                  <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600 group-hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                    {item.icon}
                  </span>
                  <span>
                    <span className="block font-semibold text-neutral-900 dark:text-neutral-100">{t(locale, item.labelKey)}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">{t(locale, item.descriptionKey)}</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </nav>
      <div className="mt-8 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm dark:border-neutral-800 dark:bg-neutral-900/70">
        <p className="font-semibold">{t(locale, "navAuth")}</p>
        <div className="mt-3 flex gap-2">
          <a className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-semibold hover:bg-white dark:border-neutral-700 dark:hover:bg-neutral-950" href="/login">{t(locale, "signIn")}</a>
          <a className="rounded-lg bg-neutral-950 px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950" href="/register">{t(locale, "createAccount")}</a>
        </div>
      </div>
    </aside>
  );
}

function OverviewSection({ locale }: { locale: Locale }) {
  return (
    <section id="overview" className="scroll-mt-24">
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_32%)] p-6 dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.24),_transparent_32%)] sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-500">{t(locale, "dashboardOverview")}</p>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "controlCenterTitle")}</h2>
              <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">{t(locale, "controlCenterSubtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">{t(locale, "statusOperational")}</span>
              <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">OpenAI /v1</span>
            </div>
          </div>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
          {overviewCards.map((card) => (
            <article key={card.detailKey} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t(locale, card.labelKey)}</p>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, card.detailKey)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function App({ locale = "en", initialRoute }: AppProps) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const route = currentRoute(initialRoute);

  useEffect(() => {
    setActiveLocale(locale);
  }, [locale]);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const themeLabel = theme === "dark" ? t(activeLocale, "switchToLightMode") : t(activeLocale, "switchToDarkMode");
  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
  const activeSectionLabel = useMemo(() => t(activeLocale, "dashboardOverview"), [activeLocale]);

  if (route === "/login" || route === "/register") {
    return <AuthView locale={activeLocale} route={route} setLocale={setActiveLocale} theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="grid min-h-screen lg:grid-cols-[20rem_1fr]">
        <Sidebar locale={activeLocale} />

        <div className="min-w-0">
          <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <nav aria-label={t(activeLocale, "breadcrumb")} className="text-sm text-neutral-500">
                  {t(activeLocale, "dashboard")} / {activeSectionLabel}
                </nav>
                <p className="mt-1 text-xl font-semibold">{t(activeLocale, "controlCenterTitle")}</p>
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
                <Button className="px-3" variant="secondary" onClick={toggleTheme}>
                  {themeLabel}
                </Button>
              </div>
            </div>
          </header>

          <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6">
            <OverviewSection locale={activeLocale} />
            <section id="stats" className="scroll-mt-24">
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
            <section id="models" className="scroll-mt-24"><ModelsPage locale={activeLocale} models={[{ id: "demo-model", providerSlug: "opencode-zen", externalModelId: "big-pickle", displayName: "Big Pickle", endpointType: "openai_chat_completions", tags: ["free", "coding"], isFree: true, isEnabled: true, pricingConfidence: "docs_pricing_verified", currentPricing: { inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: true } }]} /></section>
            <section id="model-groups" className="scroll-mt-24"><ModelGroupsPage locale={activeLocale} groups={[{ id: "demo-group", alias: "free-coding", displayName: "Free Coding", isEnabled: true, stickySessionTtlSeconds: 86400, policy: { endpointType: "openai_chat_completions", freeOnly: true, requiredTags: ["coding"] }, candidates: [{ id: "demo-candidate", externalModelId: "big-pickle", providerSlug: "opencode-zen", priority: 10, weight: 3, isEnabled: true, warnings: [] }] }]} /></section>
            <section id="api-keys" className="scroll-mt-24"><ApiKeysPage locale={activeLocale} apiKeys={[{ id: "demo-key", name: "Demo key", keyPrefix: "lr_demo1234", scopes: ["models:read"] }]} /></section>
            <section id="provider-keys" className="scroll-mt-24"><ProviderKeysPage locale={activeLocale} providerKeys={[{ id: "demo-provider-key", providerSlug: "opencode-zen", providerName: "OpenCode Zen", name: "Demo Zen key", keyPrefix: "oz_demo_", priority: 10, rpmLimit: 60, isEnabled: true, healthStatus: "unknown" }]} /></section>
            <section id="budgets" className="scroll-mt-24"><BudgetsPage locale={activeLocale} policies={[{ id: "demo-budget", scopeType: "team", scopeLabel: "Demo Team", dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] }]} /></section>
            <DashboardDocs locale={activeLocale} />
          </main>
        </div>
      </div>
    </div>
  );
}
