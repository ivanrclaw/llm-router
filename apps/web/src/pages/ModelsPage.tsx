import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export type ModelCatalogListItem = {
  id: string;
  providerSlug: string;
  externalModelId: string;
  displayName: string;
  endpointType: string;
  tags: string[];
  isFree: boolean;
  isEnabled: boolean;
  pricingConfidence: string;
  currentPricing?: null | {
    inputUsdPer1M: number;
    outputUsdPer1M: number;
    isFree: boolean;
  };
};

function priceLabel(model: ModelCatalogListItem): string {
  if (!model.currentPricing) return "—";
  if (model.currentPricing.isFree || model.isFree) return "$0 / $0 per 1M";
  return `$${model.currentPricing.inputUsdPer1M} / $${model.currentPricing.outputUsdPer1M} per 1M`;
}

function confidenceLabel(locale: Locale, confidence: string): string {
  if (confidence === "unknown") return t(locale, "unknownPricing");
  return confidence.replaceAll("_", " ");
}

export function ModelsPage({ locale, models = [] }: { locale: Locale; models?: ModelCatalogListItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(locale, "modelsTitle")}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "modelsSubtitle")}</p>
        </div>
        <button className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950">
          {t(locale, "syncModels")}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-900">{t(locale, "freeModel")}</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-900">{t(locale, "paidModel")}</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-900">{t(locale, "endpoint")}</span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 dark:bg-neutral-900">{t(locale, "coding")}</span>
      </div>

      <div className="mt-6 space-y-3">
        {models.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">{t(locale, "noModels")}</p>
        ) : (
          models.map((model) => (
            <article key={model.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-medium">{model.displayName}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{model.externalModelId} · {model.providerSlug}</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  {model.isFree ? t(locale, "freeModel") : t(locale, "paidModel")}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div><dt className="text-neutral-500">{t(locale, "endpoint")}</dt><dd>{model.endpointType}</dd></div>
                <div><dt className="text-neutral-500">{t(locale, "pricing")}</dt><dd>{priceLabel(model)}</dd></div>
                <div><dt className="text-neutral-500">{t(locale, "confidence")}</dt><dd>{confidenceLabel(locale, model.pricingConfidence)}</dd></div>
                <div><dt className="text-neutral-500">{t(locale, "scopes")}</dt><dd>{model.tags.join(", ") || "—"}</dd></div>
              </dl>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
