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
export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => { setLocaleState(readCookieLocale()); }, []);

  const setLocale = useCallback((next: Locale) => {
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);
  return { locale, setLocale, t };
}
