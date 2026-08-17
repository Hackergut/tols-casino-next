"use client";

import { useEffect, useState } from "react";
import type { VpnVerdict } from "@/lib/compliance";
import { useLocale } from "@/lib/use-locale";
import type { Locale } from "@/lib/i18n";

/**
 * VPN / restricted-jurisdiction notice.
 *
 * Two distinct behaviours, deliberately not merged:
 *
 * - `blocked` — the IP resolves to a jurisdiction the licence does not cover.
 *   Hard stop, non-dismissible. This is a legal boundary, so it does not
 *   negotiate with the user.
 *
 * - `suspected` — heuristics smell like a VPN. This is a *warning*, dismissible,
 *   and it never blocks play. Locking accounts on a heuristic guess punishes
 *   travellers and privacy-conscious players; the real enforcement point is KYC
 *   at withdrawal, where a human reviews the flag.
 *
 * The client half of the heuristic lives here because the browser is the only
 * party that knows its own timezone. It reports it once; the server decides.
 */
export function VpnNotice({
  verdict: initialVerdict,
  country,
  locale,
}: {
  verdict: VpnVerdict;
  country: string | null;
  locale?: Locale;
}) {
  const { t } = useLocale(locale);
  const [verdict, setVerdict] = useState<VpnVerdict>(initialVerdict);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Report the browser timezone so the server can run the mismatch check it
  // cannot perform alone. Skipped when already blocked — nothing left to learn.
  useEffect(() => {
    if (initialVerdict === "blocked") return;
    let cancelled = false;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    fetch("/api/compliance/geo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const next = json.data?.verdict as VpnVerdict | undefined;
        if (next) setVerdict(next);
      })
      .catch(() => {
        /* Detection is advisory: a failed probe must never break the lobby. */
      });

    return () => {
      cancelled = true;
    };
  }, [initialVerdict]);

  if (verdict === "blocked") {
    return (
      <div className="fixed inset-0 z-[95] flex items-center justify-center bg-bg px-6 text-center">
        <div className="max-w-md">
          <h1 className="font-display mb-3 text-2xl text-foreground">{t("geo.blocked.title")}</h1>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {t("geo.blocked.body").replace("{country}", country ?? "—")}
          </p>
          <a
            href="/help"
            className="inline-block text-xs text-lime underline underline-offset-2"
          >
            {t("geo.blocked.contact")}
          </a>
        </div>
      </div>
    );
  }

  if (verdict !== "suspected" || dismissed) return null;

  const open = mounted;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center p-3"
    >
      <div
        className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border border-pending/30 bg-surface/95 px-4 py-3 shadow-xl backdrop-blur-md"
        style={{
          opacity: open ? 1 : 0,
          // Enters from the top edge, so it leaves through the top edge too.
          transform: open ? "translateY(0)" : "translateY(-20%)",
          transition: "opacity 250ms var(--ease-out), transform 250ms var(--ease-out)",
        }}
      >
        <span aria-hidden className="mt-0.5 size-2 shrink-0 rounded-full bg-pending" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{t("geo.vpn.title")}</span>{" "}
          {t("geo.vpn.body")}
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t("common.dismiss")}
          className="ml-auto shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
