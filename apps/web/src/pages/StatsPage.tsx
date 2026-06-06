import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export type StatsSummary = {
  requestCount: number;
  successCount: number;
  errorCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedReadTokens: number;
  cachedWriteTokens: number;
  costUsdCents: number;
  savedUsdCents: number;
};

export type StatsBreakdownItem = Partial<StatsSummary> & {
  id: string;
  label: string;
  requestCount: number;
  costUsdCents: number;
  savedUsdCents: number;
};

export type UsageStatsView = {
  filters: { teamId: string; from?: string; to?: string };
  overview: StatsSummary;
  latency: { avgLatencyMs: number; p50LatencyMs: number; p95LatencyMs: number };
  cache: { cachedReadTokens: number; cachedWriteTokens: number; savedUsdCents: number; cacheTokenRatio: number };
  errors: Array<{ errorCode: string; count: number; httpStatus: number | null }>;
  timeSeries: Array<Partial<StatsSummary> & { date: string; requestCount: number; costUsdCents: number; savedUsdCents: number }>;
  breakdowns: {
    models: StatsBreakdownItem[];
    modelGroups: StatsBreakdownItem[];
    users: StatsBreakdownItem[];
    platformApiKeys: StatsBreakdownItem[];
    providerKeys: StatsBreakdownItem[];
  };
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function exportHref(teamId: string, stats: UsageStatsView | null): string {
  const params = new URLSearchParams();
  if (stats?.filters.from) params.set("from", stats.filters.from);
  if (stats?.filters.to) params.set("to", stats.filters.to);
  const query = params.toString();
  return `/api/teams/${teamId}/stats/export.csv${query ? `?${query}` : ""}`;
}

function Card({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
  return href ? <a href={href}>{body}</a> : body;
}

function BreakdownList({ title, items, queryParam }: { title: string; items: StatsBreakdownItem[]; queryParam: string }) {
  return (
    <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a className="flex items-center justify-between gap-3 rounded-lg bg-neutral-50 px-3 py-2 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800" href={`/dashboard/stats?${queryParam}=${encodeURIComponent(item.id)}`}>
              <span>{item.label} · {item.requestCount}</span>
              <span>{formatUsd(item.costUsdCents)} · {formatUsd(item.savedUsdCents)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StatsPage({ locale, teamId, stats }: { locale: Locale; teamId: string; stats: UsageStatsView | null }) {
  const from = stats?.filters.from ?? "";
  const to = stats?.filters.to ?? "";

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(locale, "statsTitle")}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "statsSubtitle")}</p>
        </div>
        <a className="rounded-lg bg-neutral-950 px-4 py-2 text-center text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950" href={exportHref(teamId, stats)}>
          {t(locale, "exportCsv")}
        </a>
      </div>

      <form className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          {t(locale, "fromDate")}
          <input className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="date" aria-label={t(locale, "fromDate")} defaultValue={from} />
        </label>
        <label className="text-sm font-medium">
          {t(locale, "toDate")}
          <input className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="date" aria-label={t(locale, "toDate")} defaultValue={to} />
        </label>
        <label className="text-sm font-medium">
          {t(locale, "modelFilter")}
          <input className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="text" aria-label={t(locale, "modelFilter")} placeholder="big-pickle" />
        </label>
      </form>

      {!stats ? (
        <p className="mt-6 rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">
          {t(locale, "noStatsData")}
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label={t(locale, "requests")} value={String(stats.overview.requestCount)} href="/dashboard/stats" />
            <Card label={t(locale, "cost")} value={formatUsd(stats.overview.costUsdCents)} />
            <Card label={t(locale, "savings")} value={formatUsd(stats.overview.savedUsdCents)} />
            <Card label={t(locale, "p95Latency")} value={`${stats.latency.p95LatencyMs} ms`} />
          </div>

          <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="font-medium">{t(locale, "timeSeries")}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {stats.timeSeries.map((point) => (
                <li key={point.date} className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
                  {point.date} · {point.requestCount} {t(locale, "requestsLower")} · {formatUsd(point.costUsdCents)}
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h3 className="font-medium">{t(locale, "errors")}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {stats.errors.map((error) => (
                <li key={`${error.errorCode}-${error.httpStatus}`} className="rounded-lg bg-neutral-50 px-3 py-2 dark:bg-neutral-900">
                  {error.errorCode} · {error.count} · HTTP {error.httpStatus ?? "—"}
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownList title={t(locale, "modelBreakdown")} items={stats.breakdowns.models} queryParam="modelId" />
            <BreakdownList title={t(locale, "modelGroupBreakdown")} items={stats.breakdowns.modelGroups} queryParam="modelGroupId" />
            <BreakdownList title={t(locale, "userBreakdown")} items={stats.breakdowns.users} queryParam="userId" />
            <BreakdownList title={t(locale, "apiKeyBreakdown")} items={stats.breakdowns.platformApiKeys} queryParam="platformApiKeyId" />
            <BreakdownList title={t(locale, "providerKeyBreakdown")} items={stats.breakdowns.providerKeys} queryParam="providerKeyId" />
          </div>
        </div>
      )}
    </section>
  );
}
