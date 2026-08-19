import { cookies, headers } from "next/headers";
import { AGE_COOKIE, CONSENT_COOKIE, hasAgeAck, parseConsent, type VpnVerdict } from "@/lib/compliance";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n";
import { ComplianceClient } from "./ComplianceClient";

/**
 * Server half of the compliance stack.
 *
 * Reads the durable state (cookies) and the edge's geo verdict (request
 * headers set by the proxy) during SSR, so the gate is present in the very
 * first HTML the browser paints. Doing this on the client instead would show
 * the lobby for a frame before covering it — which, for an age gate, is the
 * exact failure the gate exists to prevent.
 */
export async function ComplianceLayer() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);

  const ageAcknowledged = hasAgeAck(cookieStore.get(AGE_COOKIE)?.value);
  const consent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);

  const verdict = (headerStore.get("x-geo-verdict") as VpnVerdict | null) ?? "unknown";
  const country = headerStore.get("x-geo-country") || null;

  // The locale the proxy already resolved. Passed down so the gate renders in
  // the visitor's language on the first paint rather than flashing English.
  const headerLocale = headerStore.get("x-locale");
  const locale: Locale = (LOCALES as readonly string[]).includes(headerLocale ?? "")
    ? (headerLocale as Locale)
    : DEFAULT_LOCALE;

  return (
    <ComplianceClient
      needsAge={!ageAcknowledged}
      needsConsent={consent === null}
      verdict={verdict}
      country={country}
      locale={locale}
    />
  );
}
