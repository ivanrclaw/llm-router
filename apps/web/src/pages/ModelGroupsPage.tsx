import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export type ModelGroupCandidateItem = {
  id: string;
  externalModelId: string;
  providerSlug: string;
  priority: number;
  weight: number;
  isEnabled: boolean;
  warnings: string[];
};

export type ModelGroupListItem = {
  id: string;
  alias: string;
  displayName: string;
  isEnabled: boolean;
  stickySessionTtlSeconds: number;
  policy: { endpointType?: string; freeOnly?: boolean; requiredTags?: string[]; maxInputUsdPer1M?: number; maxOutputUsdPer1M?: number };
  candidates: ModelGroupCandidateItem[];
};

function policySummary(locale: Locale, group: ModelGroupListItem): string[] {
  const parts: string[] = [];
  if (group.policy.endpointType) parts.push(group.policy.endpointType);
  if (group.policy.freeOnly) parts.push(t(locale, "freeOnly"));
  if (group.policy.requiredTags?.length) parts.push(group.policy.requiredTags.join(", "));
  if (group.policy.maxInputUsdPer1M !== undefined) parts.push(`≤ $${group.policy.maxInputUsdPer1M}/1M input`);
  return parts;
}

export function ModelGroupsPage({ locale, groups = [] }: { locale: Locale; groups?: ModelGroupListItem[] }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t(locale, "modelGroupsTitle")}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "modelGroupsSubtitle")}</p>
        </div>
        <button className="rounded-lg bg-neutral-950 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-50 dark:text-neutral-950">
          {t(locale, "createModelGroup")}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {groups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-4 text-sm text-neutral-500 dark:border-neutral-700">{t(locale, "noModelGroups")}</p>
        ) : (
          groups.map((group) => (
            <article key={group.id} className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="font-medium">{group.displayName}</h3>
                  <p className="mt-1 text-sm text-neutral-500">{group.alias}</p>
                </div>
                <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs dark:bg-neutral-900">{group.isEnabled ? t(locale, "enabled") : t(locale, "disabled")}</span>
              </div>
              <div className="mt-4 rounded-lg bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                <p className="font-medium">{t(locale, "routingPolicy")}</p>
                <p className="mt-1 text-neutral-600 dark:text-neutral-400">{policySummary(locale, group).join(" · ") || "—"}</p>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium">{t(locale, "candidates")}</p>
                <ul className="mt-2 space-y-2 text-sm">
                  {group.candidates.map((candidate) => (
                    <li key={candidate.id} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <span>{candidate.externalModelId} · {candidate.providerSlug}</span>
                        <span>priority {candidate.priority} · {t(locale, "weight")} {candidate.weight}</span>
                      </div>
                      {candidate.warnings.length > 0 ? (
                        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          {t(locale, "candidateWarning")}: {candidate.warnings.join(", ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
