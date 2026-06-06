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

type RouteId = "overview" | "stats" | "models" | "model-groups" | "api-keys" | "provider-keys" | "budgets" | "docs";

type NavItem = {
  routeId: RouteId;
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
      { routeId: "overview", href: "/dashboard", labelKey: "navOverview", descriptionKey: "navOverviewDescription", icon: "⌁" },
      { routeId: "stats", href: "/dashboard/stats", labelKey: "navUsage", descriptionKey: "navUsageDescription", icon: "↗" },
      { routeId: "models", href: "/dashboard/models", labelKey: "navModels", descriptionKey: "navModelsDescription", icon: "◎" },
    ],
  },
  {
    titleKey: "navOperate",
    items: [
      { routeId: "model-groups", href: "/dashboard/model-groups", labelKey: "navModelGroups", descriptionKey: "navModelGroupsDescription", icon: "⇄" },
      { routeId: "api-keys", href: "/dashboard/api-keys", labelKey: "navPlatformKeys", descriptionKey: "navPlatformKeysDescription", icon: "⎇" },
      { routeId: "provider-keys", href: "/dashboard/provider-keys", labelKey: "navProviderKeys", descriptionKey: "navProviderKeysDescription", icon: "◆" },
    ],
  },
  {
    titleKey: "navSecure",
    items: [
      { routeId: "budgets", href: "/dashboard/budgets", labelKey: "navBudgets", descriptionKey: "navBudgetsDescription", icon: "◇" },
    ],
  },
  {
    titleKey: "navResources",
    items: [
      { routeId: "docs", href: "/dashboard/docs", labelKey: "navDocs", descriptionKey: "navDocsDescription", icon: "{}" },
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
  if (typeof window === "undefined") return "/dashboard";
  return window.location.pathname;
}

function normalizeRoute(route: string) {
  if (route === "/") return "/dashboard";
  return route.replace(/\/$/, "") || "/dashboard";
}

function dashboardRouteId(route: string): RouteId {
  const normalized = normalizeRoute(route);
  switch (normalized) {
    case "/dashboard/stats":
      return "stats";
    case "/dashboard/models":
      return "models";
    case "/dashboard/model-groups":
      return "model-groups";
    case "/dashboard/api-keys":
      return "api-keys";
    case "/dashboard/provider-keys":
      return "provider-keys";
    case "/dashboard/budgets":
      return "budgets";
    case "/dashboard/docs":
      return "docs";
    case "/dashboard":
    default:
      return "overview";
  }
}

function routeLabelKey(routeId: RouteId): TranslationKey {
  const match = dashboardNav.flatMap((section) => section.items).find((item) => item.routeId === routeId);
  return match?.labelKey ?? "navOverview";
}

function DashboardDocs({ locale }: { locale: Locale }) {
  const snippets = [
    { title: t(locale, "curlExample"), body: t(locale, "curlSnippet") },
    { title: t(locale, "openAiSdkExample"), body: t(locale, "openAiSdkSnippet") },
    { title: t(locale, "openCodeExample"), body: t(locale, "openCodeSnippet") },
    { title: t(locale, "genericAgentsExample"), body: t(locale, "genericAgentsSnippet") },
  ];

  return (
    <Card>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t(locale, "navResources")}</p>
        <h2 className="mt-1 text-2xl font-semibold">{t(locale, "docsTitle")}</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "docsSubtitle")}</p>
      </div>
      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {snippets.map((snippet) => (
          <article key={snippet.title} className="min-w-0 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
          <ToastViewport>{t(locale, "toastMutationNote")}</ToastViewport>
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
      <header className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <a href="/dashboard" className="flex items-center gap-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ring">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-950 text-sm font-bold text-white shadow-lg dark:bg-white dark:text-neutral-950">LR</span>
          <span>
            <span className="block text-sm font-semibold">LLM Router</span>
            <span className="text-xs text-neutral-500">{t(locale, "authProductPill")}</span>
          </span>
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label={t(locale, "language")} className="rounded-lg border border-neutral-300 bg-white/80 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
            <option value="en">{t(locale, "english")}</option>
            <option value="es">{t(locale, "spanish")}</option>
          </select>
          <Button variant="secondary" onClick={toggleTheme}>{themeLabel}</Button>
        </div>
      </header>
      <main aria-label={t(locale, "authentication")} className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-6xl items-center gap-8 px-4 pb-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="max-w-2xl">
          <p className="inline-flex rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/70">{t(locale, "authProductPill")}</p>
          <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-5xl">{t(locale, "authHeroTitle")}</h1>
          <p className="mt-4 text-base text-neutral-600 dark:text-neutral-400 sm:text-lg">{t(locale, "authHeroSubtitle")}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["authBenefitRouting", "authBenefitBudgets", "authBenefitAudit"].map((key) => (
              <div key={key} className="rounded-2xl border border-white/70 bg-white/70 p-4 text-sm shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
                {t(locale, key as TranslationKey)}
              </div>
            ))}
          </div>
        </section>
        <section className="w-full justify-self-center lg:justify-self-end">
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

function NavContent({ locale, activeRouteId, onNavigate, ariaLabel }: { locale: Locale; activeRouteId: RouteId; onNavigate: (href: string) => void; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="mt-8 space-y-6">
      {dashboardNav.map((section) => (
        <section key={section.titleKey} aria-labelledby={`${ariaLabel.replace(/\s+/g, "-")}-${section.titleKey}`}>
          <h2 id={`${ariaLabel.replace(/\s+/g, "-")}-${section.titleKey}`} className="px-2 text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">
            {t(locale, section.titleKey)}
          </h2>
          <div className="mt-2 space-y-1">
            {section.items.map((item) => {
              const isActive = item.routeId === activeRouteId;
              return (
                <a
                  key={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex items-start gap-3 rounded-2xl px-3 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-ring ${isActive ? "bg-neutral-950 text-white shadow-sm dark:bg-white dark:text-neutral-950" : "hover:bg-neutral-100 dark:hover:bg-neutral-900"}`}
                  href={item.href}
                  onClick={(event) => {
                    event.preventDefault();
                    onNavigate(item.href);
                  }}
                >
                  <span aria-hidden="true" className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${isActive ? "border-white/20 bg-white/15 text-current dark:border-neutral-950/20 dark:bg-neutral-950/10" : "border-neutral-200 bg-neutral-50 text-neutral-600 group-hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"}`}>
                    {item.icon}
                  </span>
                  <span>
                    <span className="block font-semibold">{t(locale, item.labelKey)}</span>
                    <span className={`mt-0.5 block text-xs leading-5 ${isActive ? "text-white/75 dark:text-neutral-950/65" : "text-neutral-500 dark:text-neutral-400"}`}>{t(locale, item.descriptionKey)}</span>
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

function Sidebar({ locale, activeRouteId, onNavigate }: { locale: Locale; activeRouteId: RouteId; onNavigate: (href: string) => void }) {
  return (
    <aside className="hidden border-r border-neutral-200 bg-white/90 p-5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">LLM</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">LLM Router</h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "appSubtitle")}</p>
      </div>
      <NavContent locale={locale} activeRouteId={activeRouteId} onNavigate={onNavigate} ariaLabel={t(locale, "primaryNavigation")} />
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

function MobileNavigation({ locale, activeRouteId, isOpen, onClose, onNavigate }: { locale: Locale; activeRouteId: RouteId; isOpen: boolean; onClose: () => void; onNavigate: (href: string) => void }) {
  return (
    <div aria-hidden={!isOpen} aria-label={t(locale, "mobileNavigation")} className={`fixed inset-0 z-30 lg:hidden ${isOpen ? "block" : "pointer-events-none hidden"}`}>
      <button aria-label={t(locale, "closeNavigation")} className="absolute inset-0 bg-neutral-950/50" onClick={onClose} type="button" />
      <aside className="relative h-full w-[min(22rem,calc(100vw-2rem))] overflow-y-auto border-r border-neutral-200 bg-white p-5 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500">LLM</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">LLM Router</h1>
          </div>
          <Button variant="secondary" onClick={onClose}>{t(locale, "closeNavigation")}</Button>
        </div>
        <NavContent locale={locale} activeRouteId={activeRouteId} ariaLabel={t(locale, "mobileNavigationMenu")} onNavigate={(href) => { onNavigate(href); onClose(); }} />
      </aside>
    </div>
  );
}

function OverviewSection({ locale }: { locale: Locale }) {
  return (
    <section>
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="border-b border-neutral-200 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.15),_transparent_32%)] p-5 dark:border-neutral-800 dark:bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.24),_transparent_32%)] sm:p-8">
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
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4">
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

function StatsRoute({ locale }: { locale: Locale }) {
  return (
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
  );
}

function DashboardRoute({ locale, routeId }: { locale: Locale; routeId: RouteId }) {
  switch (routeId) {
    case "stats":
      return <StatsRoute locale={locale} />;
    case "models":
      return <ModelsPage locale={locale} models={[{ id: "demo-model", providerSlug: "opencode-zen", externalModelId: "big-pickle", displayName: "Big Pickle", endpointType: "openai_chat_completions", tags: ["free", "coding"], isFree: true, isEnabled: true, pricingConfidence: "docs_pricing_verified", currentPricing: { inputUsdPer1M: 0, outputUsdPer1M: 0, isFree: true } }]} />;
    case "model-groups":
      return <ModelGroupsPage locale={locale} groups={[{ id: "demo-group", alias: "free-coding", displayName: "Free Coding", isEnabled: true, stickySessionTtlSeconds: 86400, policy: { endpointType: "openai_chat_completions", freeOnly: true, requiredTags: ["coding"] }, candidates: [{ id: "demo-candidate", externalModelId: "big-pickle", providerSlug: "opencode-zen", priority: 10, weight: 3, isEnabled: true, warnings: [] }] }]} />;
    case "api-keys":
      return <ApiKeysPage locale={locale} apiKeys={[{ id: "demo-key", name: "Demo key", keyPrefix: "lr_demo1234", scopes: ["models:read"] }]} />;
    case "provider-keys":
      return <ProviderKeysPage locale={locale} providerKeys={[{ id: "demo-provider-key", providerSlug: "opencode-zen", providerName: "OpenCode Zen", name: "Demo Zen key", keyPrefix: "oz_demo_", priority: 10, rpmLimit: 60, isEnabled: true, healthStatus: "unknown" }]} />;
    case "budgets":
      return <BudgetsPage locale={locale} policies={[{ id: "demo-budget", scopeType: "team", scopeLabel: "Demo Team", dailyBudgetUsdCents: 500, monthlyBudgetUsdCents: 10000, hardLimit: true, alertThresholds: [50, 80] }]} />;
    case "docs":
      return <DashboardDocs locale={locale} />;
    case "overview":
    default:
      return <OverviewSection locale={locale} />;
  }
}

export function App({ locale = "en", initialRoute }: AppProps) {
  const [activeLocale, setActiveLocale] = useState<Locale>(locale);
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const [route, setRoute] = useState(() => normalizeRoute(currentRoute(initialRoute)));
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setActiveLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (initialRoute) {
      setRoute(normalizeRoute(initialRoute));
      return;
    }
    const onPopState = () => setRoute(normalizeRoute(currentRoute()));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialRoute]);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  const themeLabel = theme === "dark" ? t(activeLocale, "switchToLightMode") : t(activeLocale, "switchToDarkMode");
  const toggleTheme = () => setTheme((current) => current === "dark" ? "light" : "dark");
  const activeRouteId = dashboardRouteId(route);
  const activeSectionLabel = useMemo(() => t(activeLocale, routeLabelKey(activeRouteId)), [activeLocale, activeRouteId]);
  const navigate = (href: string) => {
    const nextRoute = normalizeRoute(href);
    setRoute(nextRoute);
    if (!initialRoute && typeof window !== "undefined" && window.location.pathname !== nextRoute) {
      window.history.pushState({}, "", nextRoute);
    }
  };

  if (route === "/login" || route === "/register") {
    return <AuthView locale={activeLocale} route={route} setLocale={setActiveLocale} theme={theme} toggleTheme={toggleTheme} />;
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <div className="grid min-h-screen lg:grid-cols-[20rem_1fr]">
        <Sidebar locale={activeLocale} activeRouteId={activeRouteId} onNavigate={navigate} />
        <MobileNavigation locale={activeLocale} activeRouteId={activeRouteId} isOpen={isMobileNavOpen} onClose={() => setIsMobileNavOpen(false)} onNavigate={navigate} />

        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-3">
                <Button aria-expanded={isMobileNavOpen} aria-label={t(activeLocale, "openNavigation")} className="lg:hidden" variant="secondary" onClick={() => setIsMobileNavOpen(true)}>
                  ☰
                </Button>
                <div>
                  <nav aria-label={t(activeLocale, "breadcrumb")} className="text-sm text-neutral-500">
                    {t(activeLocale, "dashboard")} / {activeSectionLabel}
                  </nav>
                  <p className="mt-1 text-xl font-semibold">{activeSectionLabel}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[34rem]">
                <TeamSwitcher locale={activeLocale} teams={[{ id: "demo", name: "Demo Team", role: "owner" }]} selectedTeamId="demo" />
                <label className="flex flex-col gap-1 text-sm font-medium">
                  {t(activeLocale, "language")}
                  <select aria-label={t(activeLocale, "language")} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" value={activeLocale} onChange={(event) => setActiveLocale(event.target.value as Locale)}>
                    <option value="en">{t(activeLocale, "english")}</option>
                    <option value="es">{t(activeLocale, "spanish")}</option>
                  </select>
                </label>
                <Button className="px-3" variant="secondary" onClick={toggleTheme}>{themeLabel}</Button>
              </div>
            </div>
          </header>

          <main className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6">
            <DashboardRoute locale={activeLocale} routeId={activeRouteId} />
          </main>
        </div>
      </div>
    </div>
  );
}
