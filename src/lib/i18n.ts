/*
 * Locale detection + light dictionary.
 *
 * The platform picks a language from the visitor's region: geo IP country
 * first (Vercel's x-vercel-ip-country), then the browser's Accept-Language,
 * then a default. An explicit choice stored in the `locale` cookie always wins.
 * Detection is done in middleware; this module holds the mapping and strings.
 */

export const LOCALES = ["en", "it", "es", "fr", "de", "pt", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English", it: "Italiano", es: "Español", fr: "Français", de: "Deutsch", pt: "Português", ru: "Русский",
};

// Country (ISO-3166 alpha-2) → language. Anything unmapped falls back to en.
const COUNTRY_LOCALE: Record<string, Locale> = {
  IT: "it", SM: "it", VA: "it",
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es", EC: "es", UY: "es", PY: "es", BO: "es", GT: "es", CR: "es", DO: "es",
  FR: "fr", BE: "fr", LU: "fr", MC: "fr",
  DE: "de", AT: "de",
  PT: "pt", BR: "pt", AO: "pt", MZ: "pt",
  RU: "ru", BY: "ru", KZ: "ru", KG: "ru",
};

function isLocale(v: string | null | undefined): v is Locale {
  return !!v && (LOCALES as readonly string[]).includes(v);
}

export function localeFromCountry(country?: string | null): Locale | null {
  if (!country) return null;
  return COUNTRY_LOCALE[country.toUpperCase()] ?? null;
}

export function localeFromAcceptLanguage(header?: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const code = part.trim().split(";")[0].split("-")[0].toLowerCase();
    if (isLocale(code)) return code;
  }
  return null;
}

/** Explicit cookie choice wins; otherwise region, then browser, then default. */
export function resolveLocale(opts: { cookie?: string | null; country?: string | null; acceptLanguage?: string | null }): Locale {
  if (isLocale(opts.cookie)) return opts.cookie;
  return localeFromCountry(opts.country) ?? localeFromAcceptLanguage(opts.acceptLanguage) ?? DEFAULT_LOCALE;
}

// ── Starter dictionary. Extend per screen; missing keys fall back to English. ──
type Dict = Record<string, string>;
const STRINGS: Record<Locale, Dict> = {
  en: {
    "nav.lobby": "Lobby", "nav.games": "Games", "nav.live": "Live", "nav.wallet": "Wallet", "nav.chat": "Chat", "nav.rewards": "Rewards", "nav.menu": "Menu", "nav.search": "Search", "nav.casino": "Casino",
    "auth.login": "Login", "auth.register": "Register", "auth.signin": "Sign in", "common.play": "Play", "common.deposit": "Deposit", "common.withdraw": "Withdraw",
    "search.placeholder": "Search games...",
  },
  it: {
    "nav.lobby": "Lobby", "nav.games": "Giochi", "nav.live": "Live", "nav.wallet": "Portafoglio", "nav.chat": "Chat", "nav.rewards": "Premi", "nav.menu": "Menu", "nav.search": "Cerca", "nav.casino": "Casinò",
    "auth.login": "Accedi", "auth.register": "Registrati", "auth.signin": "Accedi", "common.play": "Gioca", "common.deposit": "Deposita", "common.withdraw": "Preleva",
    "search.placeholder": "Cerca giochi...",
  },
  es: {
    "nav.lobby": "Lobby", "nav.games": "Juegos", "nav.live": "En vivo", "nav.wallet": "Cartera", "nav.chat": "Chat", "nav.rewards": "Premios", "nav.menu": "Menú", "nav.search": "Buscar", "nav.casino": "Casino",
    "auth.login": "Entrar", "auth.register": "Registrarse", "auth.signin": "Entrar", "common.play": "Jugar", "common.deposit": "Depositar", "common.withdraw": "Retirar",
    "search.placeholder": "Buscar juegos...",
  },
  fr: {
    "nav.lobby": "Lobby", "nav.games": "Jeux", "nav.live": "Live", "nav.wallet": "Portefeuille", "nav.chat": "Chat", "nav.rewards": "Récompenses", "nav.menu": "Menu", "nav.search": "Rechercher", "nav.casino": "Casino",
    "auth.login": "Connexion", "auth.register": "S'inscrire", "auth.signin": "Se connecter", "common.play": "Jouer", "common.deposit": "Déposer", "common.withdraw": "Retirer",
    "search.placeholder": "Rechercher des jeux...",
  },
  de: {
    "nav.lobby": "Lobby", "nav.games": "Spiele", "nav.live": "Live", "nav.wallet": "Wallet", "nav.chat": "Chat", "nav.rewards": "Prämien", "nav.menu": "Menü", "nav.search": "Suche", "nav.casino": "Casino",
    "auth.login": "Anmelden", "auth.register": "Registrieren", "auth.signin": "Anmelden", "common.play": "Spielen", "common.deposit": "Einzahlen", "common.withdraw": "Auszahlen",
    "search.placeholder": "Spiele suchen...",
  },
  pt: {
    "nav.lobby": "Lobby", "nav.games": "Jogos", "nav.live": "Ao vivo", "nav.wallet": "Carteira", "nav.chat": "Chat", "nav.rewards": "Recompensas", "nav.menu": "Menu", "nav.search": "Buscar", "nav.casino": "Cassino",
    "auth.login": "Entrar", "auth.register": "Registrar", "auth.signin": "Entrar", "common.play": "Jogar", "common.deposit": "Depositar", "common.withdraw": "Sacar",
    "search.placeholder": "Buscar jogos...",
  },
  ru: {
    "nav.lobby": "Лобби", "nav.games": "Игры", "nav.live": "Лайв", "nav.wallet": "Кошелёк", "nav.chat": "Чат", "nav.rewards": "Награды", "nav.menu": "Меню", "nav.search": "Поиск", "nav.casino": "Казино",
    "auth.login": "Вход", "auth.register": "Регистрация", "auth.signin": "Войти", "common.play": "Играть", "common.deposit": "Депозит", "common.withdraw": "Вывод",
    "search.placeholder": "Поиск игр...",
  },
};

/** Translate a key for a locale, falling back to English then the key itself. */
export function translate(locale: Locale, key: string): string {
  return STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
}
