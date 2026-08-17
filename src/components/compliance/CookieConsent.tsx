"use client";

import { useCallback, useEffect, useState } from "react";
import {
  COMPLIANCE_COOKIE_MAX_AGE,
  CONSENT_COOKIE,
  acceptAllConsent,
  defaultConsent,
  serializeConsent,
  type ConsentState,
} from "@/lib/compliance";
import { useLocale } from "@/lib/use-locale";
import type { Locale } from "@/lib/i18n";

/**
 * Cookie consent banner (GDPR / ePrivacy).
 *
 * Three equally-weighted paths — accept all, reject non-essential, customise.
 * "Reject" is a real button of the same prominence as "accept", not a buried
 * link: a consent dialog that makes refusal harder than acceptance is not
 * valid consent under GDPR Art. 7(3), and it is the single most common way
 * these banners fail an audit.
 *
 * Motion: occasional surface → standard animation. It slides from the bottom
 * edge and leaves through the bottom edge, so the direction stays honest.
 */
export function CookieConsent({
  onResolved,
  locale,
}: {
  onResolved: () => void;
  locale?: Locale;
}) {
  const { t } = useLocale(locale);
  const [mounted, setMounted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const persist = useCallback(
    (state: ConsentState) => {
      document.cookie = `${CONSENT_COOKIE}=${serializeConsent(state)}; path=/; max-age=${COMPLIANCE_COOKIE_MAX_AGE}; samesite=lax`;
      // Let other parts of the app react without a reload (analytics loaders).
      window.dispatchEvent(new CustomEvent("tols:consent", { detail: state }));
      setLeaving(true);
      window.setTimeout(onResolved, 300);
    },
    [onResolved],
  );

  const open = mounted && !leaving;

  return (
    <div
      role="region"
      aria-label={t("cookies.title")}
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[90] flex justify-center p-3 sm:p-4"
    >
      <div
        className="pointer-events-auto w-full max-w-2xl rounded-2xl border border-border-strong bg-surface/95 p-5 shadow-2xl backdrop-blur-md"
        style={{
          opacity: open ? 1 : 0,
          // translateY in % is relative to the element's own height, so the
          // banner clears itself whatever the content length.
          transform: open ? "translateY(0)" : "translateY(12%)",
          transition: "opacity 300ms var(--ease-out), transform 300ms var(--ease-out)",
        }}
      >
        <h2 className="font-display mb-2 text-sm text-foreground">{t("cookies.title")}</h2>
        <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
          {t("cookies.body")}{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-lime">
            {t("cookies.policy")}
          </a>
        </p>

        {customising && (
          <div className="mb-4 space-y-2.5 rounded-xl border border-border bg-bg/40 p-3.5">
            <ConsentRow
              label={t("cookies.necessary")}
              description={t("cookies.necessary.desc")}
              checked
              disabled
              onChange={() => {}}
            />
            <ConsentRow
              label={t("cookies.analytics")}
              description={t("cookies.analytics.desc")}
              checked={analytics}
              onChange={setAnalytics}
            />
            <ConsentRow
              label={t("cookies.marketing")}
              description={t("cookies.marketing.desc")}
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => persist(acceptAllConsent())}
            className="flex-1 rounded-xl bg-lime px-4 py-2.5 text-xs font-bold text-bg transition-[background-color] duration-150 hover:bg-lime-200"
          >
            {t("cookies.acceptAll")}
          </button>
          <button
            type="button"
            onClick={() => persist(defaultConsent())}
            className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-surface-raised"
          >
            {t("cookies.rejectAll")}
          </button>
          {customising ? (
            <button
              type="button"
              onClick={() =>
                persist({ ...defaultConsent(), analytics, marketing })
              }
              className="flex-1 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-surface-raised"
            >
              {t("cookies.save")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCustomising(true)}
              className="rounded-xl px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              {t("cookies.customise")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--lime-300)]"
      />
      <span>
        <span className="block text-xs font-semibold text-foreground">{label}</span>
        <span className="block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
