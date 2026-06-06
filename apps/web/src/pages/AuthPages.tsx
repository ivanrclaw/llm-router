import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { Button } from "../components/ui";

function inputClass() {
  return "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-ring dark:border-neutral-700 dark:bg-neutral-900";
}

export function LoginPage({ locale = "en" }: { locale?: Locale }) {
  return (
    <section aria-labelledby="login-title" className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white/90 p-8 shadow-2xl shadow-neutral-900/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <h2 id="login-title" className="text-2xl font-bold tracking-tight">{t(locale, "loginTitle")}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "loginSubtitle")}</p>
      <form className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t(locale, "email")}
          <input className={inputClass()} type="email" autoComplete="email" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "password")}
          <input className={inputClass()} type="password" autoComplete="current-password" />
        </label>
        <Button className="w-full justify-center py-2.5" type="submit">
          {t(locale, "signIn")}
        </Button>
      </form>
    </section>
  );
}

export function RegisterPage({ locale = "en" }: { locale?: Locale }) {
  return (
    <section aria-labelledby="register-title" className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white/90 p-8 shadow-2xl shadow-neutral-900/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <h2 id="register-title" className="text-2xl font-bold tracking-tight">{t(locale, "registerTitle")}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "registerSubtitle")}</p>
      <form className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t(locale, "name")}
          <input className={inputClass()} type="text" autoComplete="name" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "email")}
          <input className={inputClass()} type="email" autoComplete="email" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "password")}
          <input className={inputClass()} type="password" autoComplete="new-password" />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "teamName")}
          <input className={inputClass()} type="text" />
        </label>
        <Button className="w-full justify-center py-2.5" type="submit">
          {t(locale, "createAccount")}
        </Button>
      </form>
    </section>
  );
}
