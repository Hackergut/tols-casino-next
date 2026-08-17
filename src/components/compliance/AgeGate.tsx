"use client";

import { useCallback, useEffect, useState } from "react";
import { AGE_COOKIE, COMPLIANCE_COOKIE_MAX_AGE, CONSENT_VERSION, MIN_AGE } from "@/lib/compliance";
import { useLocale } from "@/lib/use-locale";
import type { Locale } from "@/lib/i18n";

/**
 * 18+ gate.
 *
 * Rendered by the server (see ComplianceLayer) only when the age cookie is
 * absent, so there is no client-side flash of the lobby before it appears and
 * no hydration mismatch — the server already knows the answer.
 *
 * Motion budget: this is a first-visit-only surface, which is the tier where
 * a real entrance is justified. Backdrop and panel share one 250ms ease-out so
 * they read as a single surface arriving. Nothing here loops.
 */
export function AgeGate({
  onAcknowledge,
  locale,
}: {
  onAcknowledge: () => void;
  locale?: Locale;
}) {
  const { t } = useLocale(locale);
  const [leaving, setLeaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [denied, setDenied] = useState(false);

  // Entrance: flip on the next frame so the browser has a "from" state to
  // transition out of. Without the rAF the element mounts already-open.
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // The gate owns the scroll lock while it is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const confirm = useCallback(() => {
    document.cookie = `${AGE_COOKIE}=${CONSENT_VERSION}; path=/; max-age=${COMPLIANCE_COOKIE_MAX_AGE}; samesite=lax`;
    setLeaving(true);
    // Let the exit play before unmounting. Matches the 250ms below.
    window.setTimeout(onAcknowledge, 250);
  }, [onAcknowledge]);

  if (denied) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-bg px-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display mb-3 text-2xl text-foreground">{t("age.denied.title")}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("age.denied.body")}</p>
        </div>
      </div>
    );
  }

  const open = mounted && !leaving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        style={{
          opacity: open ? 1 : 0,
          transition: "opacity 250ms var(--ease-out)",
        }}
      />

      <div
        className="relative w-full max-w-md rounded-2xl border border-border-strong bg-surface p-7 shadow-2xl"
        style={{
          opacity: open ? 1 : 0,
          // Never scale(0): nothing in the real world appears from nothing.
          transform: open ? "scale(1)" : "scale(0.96)",
          transition: "opacity 250ms var(--ease-out), transform 250ms var(--ease-out)",
        }}
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="font-display grid size-12 shrink-0 place-items-center rounded-full border border-lime/30 bg-lime/10 text-base text-lime">
            {MIN_AGE}+
          </span>
          <div>
            <h2 id="age-gate-title" className="font-display text-lg leading-tight text-foreground">
              {t("age.title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("age.subtitle")}</p>
          </div>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{t("age.body")}</p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={confirm}
            className="w-full rounded-xl bg-lime px-4 py-3 text-sm font-bold text-bg transition-[background-color] duration-150 hover:bg-lime-200"
          >
            {t("age.confirm").replace("{age}", String(MIN_AGE))}
          </button>
          <button
            type="button"
            onClick={() => setDenied(true)}
            className="w-full rounded-xl border border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-raised hover:text-foreground"
          >
            {t("age.deny")}
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground/70">
          {t("age.footer")}{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-lime">
            {t("age.terms")}
          </a>{" "}
          ·{" "}
          <a href="/responsible-gaming" className="underline underline-offset-2 hover:text-lime">
            {t("age.responsible")}
          </a>
        </p>
      </div>
    </div>
  );
}
