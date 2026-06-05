import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export type ProviderKeyListItem = {
  id: string;
  providerSlug: string;
  providerName: string;
  name: string;
  keyPrefix: string;
  priority: number;
  rpmLimit?: number | null;
  isEnabled: boolean;
  healthStatus: string;
  lastValidatedAt?: string | null;
};

function healthLabel(locale: Locale, status: string): string {
  if (status === "healthy") return t(locale, "healthy");
  if (status === "rate_limited") return t(locale, "rateLimited");
  if (status === "invalid") return t(locale, "invalid");
  return t(locale, "unknown");
}

export function ProviderKeysPage({ locale, providerKeys = [] }: { locale: Locale; providerKeys?: ProviderKeyListItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(locale, "providerKeysTitle")}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "providerKeysSubtitle")}</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700">{t(locale, "validateProviderKey")}</button>
          <button className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950">{t(locale, "createProviderKey")}</button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {providerKeys.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">{t(locale, "noProviderKeys")}</p>
        ) : (
          providerKeys.map((key) => (
            <article key={key.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="font-medium">{key.name}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{key.providerName} · {key.providerSlug}</p>
                </div>
                <code className="rounded bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-900">{key.keyPrefix}••••••••</code>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-neutral-500">{t(locale, "priority")}</dt><dd>{key.priority}</dd></div>
                <div><dt className="text-neutral-500">{t(locale, "rateLimit")}</dt><dd>{key.rpmLimit ? `${key.rpmLimit} rpm` : "—"}</dd></div>
                <div><dt className="text-neutral-500">{t(locale, "health")}</dt><dd>{healthLabel(locale, key.healthStatus)}</dd></div>
                <div><dt className="text-neutral-500">{t(locale, "provider")}</dt><dd>{key.isEnabled ? "Enabled" : "Disabled"}</dd></div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
