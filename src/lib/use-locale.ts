"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, translate, type Locale } from "@/lib/i18n";

function readCookieLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const m = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
  const v = m?.[1];
  return (LOCALES as readonly string[]).includes(v ?? "") ? (v as Locale) : DEFAULT_LOCALE;
}

/**
 * Client-side locale + translator. Reads the `locale` cookie set by the
 * region-detecting middleware; `setLocale` persists an explicit choice and
 * reloads so the whole tree (and <html lang>) re-renders in the new language.
 */
export function useLocale(initial?: Locale) {
  // `initial` is the locale the server already resolved (cookie, else geo IP).
  // Passing it matters for anything rendered in the first paint — without it
  // the component renders English, then flips after hydration, which is a
  // visible language flash on exactly the surfaces users read most carefully.
  const [locale, setLocaleState] = useState<Locale>(initial ?? DEFAULT_LOCALE);
  useEffect(() => {
    // The cookie is authoritative once present; on a first visit it is set by
    // the same response that rendered this, so `initial` already matches.
    const fromCookie = readCookieLocale();
    setLocaleState((prev) => (fromCookie !== DEFAULT_LOCALE ? fromCookie : prev));
  }, []);

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);
  return { locale, setLocale, t };
}
