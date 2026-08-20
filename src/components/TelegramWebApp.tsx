'use client';

import { useEffect } from "react";

/*
 * Telegram Mini App bootstrap.
 *
 * Runs once on mount, does nothing outside Telegram, and never blocks render.
 *
 * Two things worth knowing about this file:
 *
 * 1. It waits for the SDK with an event + timeout rather than a 100ms polling
 *    interval that ran 50 times on every non-Telegram page load. The script is
 *    loaded `afterInteractive`, so it genuinely may not be there on first tick.
 *
 * 2. The initData exchange is guarded by sessionStorage against a reload loop.
 *    That guard used to be set BEFORE the request and cleared on failure — but
 *    a hard failure (network drop, 500) between the two left it set with no
 *    session, so the user was stuck logged out until they killed the app. It
 *    is now only set once the server confirms a session.
 */

interface TelegramWebAppSdk {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation?: () => void;
  version?: string;
  colorScheme?: string;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebAppSdk };
  }
}

/** Matches --bg in globals.css so Telegram's chrome has no visible seam. */
const SURFACE = "#0f1015";

const AUTH_FLAG = "tols_tg_session";

function configure(wa: TelegramWebAppSdk): void {
  // Each call is individually guarded: these are version-gated in the SDK and
  // an older Telegram client throws on the newer ones, which would abort the
  // rest of the setup mid-way.
  try { wa.ready?.(); } catch {}
  try { wa.expand?.(); } catch {}
  try { wa.setHeaderColor?.(SURFACE); } catch {}
  try { wa.setBackgroundColor?.(SURFACE); } catch {}

  // A pull-down gesture closing the app mid-bet loses the round from the
  // player's view even though the server settled it. Bot API 7.7+.
  try { wa.disableVerticalSwipes?.(); } catch {}

  // Ask before closing, for the same reason.
  try { wa.enableClosingConfirmation?.(); } catch {}
}

async function authenticate(initData: string): Promise<void> {
  if (!initData) return;
  if (sessionStorage.getItem(AUTH_FLAG) === "1") return;

  try {
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });

    if (!res.ok) return; // no flag set — a later mount may retry

    // Only now is a session guaranteed, so the reload cannot loop.
    sessionStorage.setItem(AUTH_FLAG, "1");
    window.location.reload();
  } catch {
    /* offline or blocked — leave unflagged so it can retry */
  }
}

export default function TelegramWebApp() {
  useEffect(() => {
    let cancelled = false;

    const boot = () => {
      if (cancelled) return true;
      const wa = window.Telegram?.WebApp;
      if (!wa) return false;
      configure(wa);
      void authenticate(wa.initData ?? "");
      return true;
    };

    if (boot()) return;

    // The SDK does not emit a load event of its own, so poll briefly — but
    // with a hard stop, and slower than the old 100ms.
    let waited = 0;
    const timer = setInterval(() => {
      waited += 200;
      if (boot() || waited >= 4000) clearInterval(timer);
    }, 200);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return null;
}
