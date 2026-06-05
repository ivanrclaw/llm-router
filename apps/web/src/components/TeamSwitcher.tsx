import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

type Team = { id: string; name: string; role: "owner" | "admin" | "member" | "viewer" };

export function TeamSwitcher({ locale = "en", teams, selectedTeamId }: { locale?: Locale; teams: Team[]; selectedTeamId?: string }) {
  const selected = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {t(locale, "teamSwitcherLabel")}
      <select className="rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" defaultValue={selected?.id ?? ""} aria-label={t(locale, "teamSwitcherLabel")}>
        {teams.map((team) => (
          <option key={team.id} value={team.id}>
            {team.name} · {t(locale, team.role)}
          </option>
        ))}
      </select>
    </label>
  );
}
