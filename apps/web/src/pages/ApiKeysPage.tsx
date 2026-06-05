import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { ApiKeyCreateDialog } from "./ApiKeyCreateDialog";

export type ApiKeyListItem = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  dailyBudgetUsdCents?: number | null;
  monthlyBudgetUsdCents?: number | null;
  rateLimitRpm?: number | null;
  revokedAt?: string | null;
};

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ApiKeysPage({
  locale = "en",
  apiKeys,
  createdKey,
}: {
  locale?: Locale;
  apiKeys: ApiKeyListItem[];
  createdKey?: string;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t(locale, "apiKeysTitle")}</h2>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "apiKeysSubtitle")}</p>
        </div>
        <button className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950" type="button">
          {t(locale, "createApiKey")}
        </button>
      </div>

      <ApiKeyCreateDialog locale={locale} createdKey={createdKey} />

      <div className="mt-6 space-y-3">
        {apiKeys.length === 0 ? <p className="text-sm text-neutral-500">{t(locale, "noApiKeys")}</p> : null}
        {apiKeys.map((apiKey) => (
          <article key={apiKey.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold">{apiKey.name}</h3>
                <p className="text-sm text-neutral-500">{t(locale, "keyPrefix")}: <span>{apiKey.keyPrefix}</span></p>
              </div>
              <button className="rounded-lg border px-3 py-1.5 text-sm dark:border-neutral-700" type="button">{t(locale, "revoke")}</button>
            </div>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-medium">{t(locale, "scopes")}</dt>
                <dd>{apiKey.scopes.join(", ")}</dd>
              </div>
              <div>
                <dt className="font-medium">{t(locale, "budgets")}</dt>
                {apiKey.dailyBudgetUsdCents != null ? <dd>{t(locale, "dailyBudget")}: {formatUsd(apiKey.dailyBudgetUsdCents)}</dd> : null}
                {apiKey.monthlyBudgetUsdCents != null ? <dd>{t(locale, "monthlyBudget")}: {formatUsd(apiKey.monthlyBudgetUsdCents)}</dd> : null}
              </div>
              <div>
                <dt className="font-medium">{t(locale, "rateLimit")}</dt>
                <dd>{apiKey.rateLimitRpm ? `${apiKey.rateLimitRpm} rpm` : "—"}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
