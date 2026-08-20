"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, translate, type Locale } from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
const LocaleContext = createContext<LocaleContextValue | null>(null);

function interpolate(value: string, vars?: Record<string, string | number>): string {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

/** One locale source for the entire app, seeded by Edge geo detection before SSR. */
export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = useCallback((next: Locale) => {
    if (!(LOCALES as readonly string[]).includes(next)) return;
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setLocaleState(next);
    // Server metadata, html[lang] and server components must change together.
    window.location.reload();
  }, []);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => interpolate(translate(locale, key), vars), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(_initial?: Locale): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (context) return context;
  // Defensive fallback for isolated component tests; production always wraps.
  return { locale: DEFAULT_LOCALE, setLocale: () => {}, t: (key, vars) => interpolate(translate(DEFAULT_LOCALE, key), vars) };
}
