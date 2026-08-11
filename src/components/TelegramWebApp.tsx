'use client';

import { useEffect } from "react";

/*
 * Telegram Mini App bootstrap.
 *
 * Polls for the Telegram SDK to load (window.Telegram.WebApp) rather than
 * checking once on mount — the external SDK script may still be downloading
 * when the component first runs. Once available: signal ready, expand to
 * full height, set the theme, and exchange initData for a server session.
 * Outside Telegram it does nothing (5s timeout, then gives up).
 */

declare global {
  interface Window {
    Telegram?: { WebApp?: any };
  }
}

export default function TelegramWebApp() {
  useEffect(() => {
    let attempts = 0;
    const timer = setInterval(() => {
      const wa = window.Telegram?.WebApp;
      if (!wa) {
        if (++attempts > 50) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      try { wa.ready(); } catch {}
      try { wa.expand(); } catch {}
      // Match the current matte-black palette (#0f1015) so the Telegram chrome
      // blends into the app instead of showing a seam at the top edge.
      try { wa.setHeaderColor?.("#0f1015"); } catch {}
      try { wa.setBackgroundColor?.("#0f1015"); } catch {}
      // In a game, an accidental pull-down closing the Mini App mid-bet is a
      // real loss of state — disable it where the SDK supports it (Bot API 7.7+).
      try { wa.disableVerticalSwipes?.(); } catch {}

      const initData = wa.initData;
      if (initData && sessionStorage.getItem("tg_authed") !== "1") {
        sessionStorage.setItem("tg_authed", "1");
        fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData }),
        })
          .then((r) => {
            if (r.ok) window.location.reload();
            else sessionStorage.removeItem("tg_authed");
          })
          .catch(() => sessionStorage.removeItem("tg_authed"));
      }
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return null;
}
