import type { FormEvent } from "react";
import type { Locale } from "../lib/i18n";
import { t } from "../lib/i18n";
import { Button } from "../components/ui";

function inputClass() {
  return "mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 shadow-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-ring dark:border-neutral-700 dark:bg-neutral-900";
}

type LoginValues = { email: string; password: string };
type RegisterValues = { name: string; email: string; password: string; teamName: string };

type AuthFormProps<TValues> = {
  locale?: Locale;
  error?: string | null;
  isSubmitting?: boolean;
  onSubmit?: (values: TValues) => void;
};

export function LoginPage({ locale = "en", error, isSubmitting = false, onSubmit }: AuthFormProps<LoginValues>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit?.({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
  };

  return (
    <section aria-labelledby="login-title" className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white/90 p-8 shadow-2xl shadow-neutral-900/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <h2 id="login-title" className="text-2xl font-bold tracking-tight">{t(locale, "loginTitle")}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "loginSubtitle")}</p>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium">
          {t(locale, "email")}
          <input className={inputClass()} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "password")}
          <input className={inputClass()} name="password" type="password" autoComplete="current-password" required />
        </label>
        <Button className="w-full justify-center py-2.5" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t(locale, "signingIn") : t(locale, "signIn")}
        </Button>
      </form>
    </section>
  );
}

export function RegisterPage({ locale = "en", error, isSubmitting = false, onSubmit }: AuthFormProps<RegisterValues>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit?.({
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      teamName: String(form.get("teamName") ?? ""),
    });
  };

  return (
    <section aria-labelledby="register-title" className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white/90 p-8 shadow-2xl shadow-neutral-900/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <h2 id="register-title" className="text-2xl font-bold tracking-tight">{t(locale, "registerTitle")}</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t(locale, "registerSubtitle")}</p>
      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</p> : null}
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium">
          {t(locale, "name")}
          <input className={inputClass()} name="name" type="text" autoComplete="name" required />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "email")}
          <input className={inputClass()} name="email" type="email" autoComplete="email" required />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "password")}
          <input className={inputClass()} name="password" type="password" autoComplete="new-password" required />
        </label>
        <label className="block text-sm font-medium">
          {t(locale, "teamName")}
          <input className={inputClass()} name="teamName" type="text" required />
        </label>
        <Button className="w-full justify-center py-2.5" type="submit" disabled={isSubmitting}>
          {isSubmitting ? t(locale, "creatingAccount") : t(locale, "createAccount")}
        </Button>
      </form>
    </section>
  );
}
