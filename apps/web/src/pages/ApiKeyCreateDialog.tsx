import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export type NewApiKeyDraft = {
  name: string;
  scopes: string[];
  dailyBudgetUsdCents?: number | null;
  monthlyBudgetUsdCents?: number | null;
  rateLimitRpm?: number | null;
};

export function ApiKeyCreateDialog({
  locale = "en",
  createdKey,
  onCopy,
}: {
  locale?: Locale;
  createdKey?: string;
  onCopy?: (key: string) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800" role="dialog" aria-label={t(locale, "createApiKey")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t(locale, "apiKeyName")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" name="name" placeholder="CI key" />
        </label>
        <label className="text-sm font-medium">
          {t(locale, "rateLimit")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" name="rateLimitRpm" placeholder="60 rpm" />
        </label>
      </div>
      <fieldset className="mt-4 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <legend className="px-1 text-sm font-medium">{t(locale, "scopes")}</legend>
        <label className="mr-4 text-sm"><input defaultChecked type="checkbox" /> models:read</label>
        <label className="text-sm"><input defaultChecked type="checkbox" /> chat:write</label>
      </fieldset>
      <button className="mt-4 rounded-lg bg-neutral-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950" type="button">
        {t(locale, "createApiKey")}
      </button>
      {createdKey ? (
        <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
          <p className="font-medium">{t(locale, "copyCreatedKey")}</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-3 dark:bg-neutral-900">{createdKey}</code>
          <button className="mt-3 rounded-lg border px-3 py-1.5 text-sm dark:border-neutral-700" type="button" onClick={() => onCopy?.(createdKey)}>
            {t(locale, "copy")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
