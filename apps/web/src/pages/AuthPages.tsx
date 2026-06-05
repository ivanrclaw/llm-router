import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";

export function LoginPage({ locale = "en" }: { locale?: Locale }) {
  return (
    <section aria-labelledby="login-title" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 id="login-title" className="text-2xl font-bold tracking-tight">{t(locale, "loginTitle")}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "loginSubtitle")}</p>
      <form className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t(locale, "email")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="email" autoComplete="email" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "password")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="password" autoComplete="current-password" />
        </label>
        <button className="w-full rounded-lg bg-neutral-950 px-4 py-2 font-semibold text-white dark:bg-white dark:text-neutral-950" type="submit">
          {t(locale, "signIn")}
        </button>
      </form>
    </section>
  );
}

export function RegisterPage({ locale = "en" }: { locale?: Locale }) {
  return (
    <section aria-labelledby="register-title" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
      <h2 id="register-title" className="text-2xl font-bold tracking-tight">{t(locale, "registerTitle")}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "registerSubtitle")}</p>
      <form className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t(locale, "name")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="text" autoComplete="name" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "email")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="email" autoComplete="email" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "password")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="password" autoComplete="new-password" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "teamName")}
          <input className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900" type="text" />
        </label>
        <button className="w-full rounded-lg bg-neutral-950 px-4 py-2 font-semibold text-white dark:bg-white dark:text-neutral-950" type="submit">
          {t(locale, "createAccount")}
        </button>
      </form>
    </section>
  );
}
