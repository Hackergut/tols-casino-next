"use client";

import { useState } from "react";
import type { VpnVerdict } from "@/lib/compliance";
import type { Locale } from "@/lib/i18n";
import { AgeGate } from "./AgeGate";
import { CookieConsent } from "./CookieConsent";
import { VpnNotice } from "./VpnNotice";

/**
 * Client half of the compliance stack — owns only the "has this been resolved
 * during this page view" state. The initial values come from the server, so
 * the first render is already correct.
 *
 * Ordering is deliberate and sequential rather than stacked: the age gate is
 * the only thing on screen until it is answered, and the cookie banner appears
 * after it. Two blocking dialogs at once is how these flows become the thing
 * users click through blindly — which defeats the purpose of asking.
 */
export function ComplianceClient({
  needsAge,
  needsConsent,
  verdict,
  country,
  locale,
}: {
  needsAge: boolean;
  needsConsent: boolean;
  verdict: VpnVerdict;
  country: string | null;
  locale: Locale;
}) {
  const [ageOpen, setAgeOpen] = useState(needsAge);
  const [consentOpen, setConsentOpen] = useState(needsConsent);

  // A blocked jurisdiction supersedes everything: no point asking someone's
  // age when they cannot be served regardless of the answer.
  if (verdict === "blocked") {
    return <VpnNotice verdict={verdict} country={country} locale={locale} />;
  }

  return (
    <>
      <VpnNotice verdict={verdict} country={country} locale={locale} />
      {ageOpen && <AgeGate locale={locale} onAcknowledge={() => setAgeOpen(false)} />}
      {!ageOpen && consentOpen && (
        <CookieConsent locale={locale} onResolved={() => setConsentOpen(false)} />
      )}
    </>
  );
}
