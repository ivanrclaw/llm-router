export type Locale = "en" | "es";

export const dictionaries = {
  en: {
    appSubtitle: "Multi-tenant LLM API gateway with model categorization",
    healthCheck: "Health Check",
    loginTitle: "Sign in to LLM Router",
    loginSubtitle: "Access your team dashboard, API keys, budgets, and routing analytics.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    registerTitle: "Create your LLM Router account",
    registerSubtitle: "Create a user, default team, and owner membership in one secure step.",
    name: "Name",
    teamName: "Team name",
    createAccount: "Create account",
    teamSwitcherLabel: "Current team",
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
  },
  es: {
    appSubtitle: "Gateway LLM multi-equipo con categorización de modelos",
    healthCheck: "Comprobar salud",
    loginTitle: "Inicia sesión en LLM Router",
    loginSubtitle: "Accede al panel de tu equipo, claves API, presupuestos y analíticas de routing.",
    email: "Correo electrónico",
    password: "Contraseña",
    signIn: "Iniciar sesión",
    registerTitle: "Crea tu cuenta de LLM Router",
    registerSubtitle: "Crea usuario, equipo inicial y membresía owner en un único paso seguro.",
    name: "Nombre",
    teamName: "Nombre del equipo",
    createAccount: "Crear cuenta",
    teamSwitcherLabel: "Equipo actual",
    owner: "Propietario",
    admin: "Administrador",
    member: "Miembro",
    viewer: "Lector",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries.en;

export function t(locale: Locale, key: TranslationKey): string {
  return dictionaries[locale][key];
}
