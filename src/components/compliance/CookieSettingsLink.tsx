"use client";

import { CONSENT_COOKIE } from "@/lib/compliance";

/**
 * "Cookie settings" control for the footer.
 *
 * GDPR Art. 7(3) requires withdrawing consent to be as easy as giving it, so
 * the banner cannot be a one-time event — there has to be a way back to it.
 * Clearing the cookie and reloading re-runs the same server-side path that
 * shows the banner on a first visit, which keeps one code path instead of a
 * second "manage preferences" modal that can drift out of sync with it.
 */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        document.cookie = `${CONSENT_COOKIE}=; path=/; max-age=0; samesite=lax`;
        window.location.reload();
      }}
      className={className ?? "text-xs text-muted-foreground transition-colors duration-150 hover:text-lime"}
    >
      Cookie settings
    </button>
  );
}
