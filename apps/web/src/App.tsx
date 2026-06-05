import { TeamSwitcher } from "./components/TeamSwitcher";
import { t, type Locale } from "./lib/i18n";
import { LoginPage, RegisterPage } from "./pages/AuthPages";

export function App({ locale = "en" }: { locale?: Locale }) {
  return (
    <div className="min-h-screen bg-neutral-50 p-8 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">LLM Router</h1>
          <p className="mt-2 text-lg text-neutral-600 dark:text-neutral-400">{t(locale, "appSubtitle")}</p>
        </div>
        <a href="/api/health" className="rounded-lg bg-neutral-100 px-4 py-2 text-sm transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700">
          {t(locale, "healthCheck")}
        </a>
      </header>

      <main className="mx-auto mt-10 grid max-w-6xl gap-6 lg:grid-cols-2">
        <LoginPage locale={locale} />
        <RegisterPage locale={locale} />
        <div className="lg:col-span-2 rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
          <TeamSwitcher
            locale={locale}
            teams={[{ id: "demo", name: "Demo Team", role: "owner" }]}
            selectedTeamId="demo"
          />
        </div>
      </main>
    </div>
  );
}
