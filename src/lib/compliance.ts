/*
 * Compliance gate: age verification, cookie consent, and VPN/proxy detection.
 *
 * These three are grouped because they share one property: they are decided
 * before the visitor is allowed to interact with the product, and each one is
 * a legal requirement rather than a feature.
 *
 * Design constraint that shapes everything below: the *gate* must be able to
 * render on the very first paint without a flash of the lobby behind it. So
 * the durable state lives in cookies (readable by the server on the initial
 * request), not in localStorage.
 */

export const AGE_COOKIE = "tols_age_ack";
export const CONSENT_COOKIE = "tols_cookie_consent";
/** Bump when the policy text changes materially — invalidates prior consent. */
export const CONSENT_VERSION = "1";
export const MIN_AGE = 18;

/** A year. Long enough not to nag, short enough to re-confirm periodically. */
export const COMPLIANCE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/* ────────────────────────────── Cookie consent ────────────────────────────── */

/**
 * Consent categories. `necessary` is not optional — session, auth and the
 * compliance cookies themselves cannot be declined without breaking the site,
 * which is exactly the carve-out GDPR Art. 5(3) allows.
 */
export interface ConsentState {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  /** Policy version this choice was made against. */
  v: string;
  /** ISO timestamp — proof-of-consent needs a date, not just a flag. */
  at: string;
}

export function defaultConsent(): ConsentState {
  return { necessary: true, analytics: false, marketing: false, v: CONSENT_VERSION, at: new Date().toISOString() };
}

export function acceptAllConsent(): ConsentState {
  return { necessary: true, analytics: true, marketing: true, v: CONSENT_VERSION, at: new Date().toISOString() };
}

/**
 * Parse a consent cookie. Returns null when absent, malformed, or issued
 * against an older policy version — all three mean "ask again".
 */
export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>;
    if (parsed?.v !== CONSENT_VERSION) return null;
    return {
      necessary: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      v: CONSENT_VERSION,
      at: typeof parsed.at === "string" ? parsed.at : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function serializeConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state));
}

/* ────────────────────────────── Age verification ───────────────────────────── */

/** Whether the visitor has already confirmed they are of age. */
export function hasAgeAck(raw: string | null | undefined): boolean {
  return raw === CONSENT_VERSION;
}

/**
 * Full date-of-birth check, used where a real age is collected (registration).
 * The banner gate only takes a yes/no attestation; this is the stricter path.
 */
export function isOfAge(dob: Date, minAge = MIN_AGE, now = new Date()): boolean {
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age--;
  return age >= minAge;
}

/* ────────────────────────────── VPN / proxy detection ──────────────────────── */

export type VpnVerdict = "clear" | "suspected" | "blocked" | "unknown";

export interface GeoSignals {
  /** ISO-3166 alpha-2 from the edge (Vercel's x-vercel-ip-country). */
  country: string | null;
  ip: string | null;
  /** True when the edge itself flags the address as a known proxy/relay. */
  edgeProxyFlag: boolean;
  /** Timezone the browser reports, used for the mismatch heuristic. */
  clientTimezone?: string | null;
}

export interface VpnAssessment {
  verdict: VpnVerdict;
  /** Human-readable signals that produced the verdict — shown to support, not the player. */
  reasons: string[];
  country: string | null;
}

/*
 * Jurisdictions the platform must not serve.
 *
 * The default is the set that virtually every unlicensed crypto casino blocks
 * (regulators with active enforcement against offshore operators). It is NOT a
 * legal opinion and it is NOT complete — set BLOCKED_COUNTRIES explicitly once
 * you know which licence you hold.
 *
 * Note IT is absent from the default on purpose: Italy requires an ADM licence,
 * so it belongs on this list for an unlicensed operator — but this product is
 * Italian-facing, and silently blocking your own market (and your own office)
 * via a default nobody chose is worse than making you opt in. Add it via env.
 */
export const BLOCKED_COUNTRIES = new Set<string>(
  (process.env.BLOCKED_COUNTRIES ?? "US,GB,FR,NL,AU,SG,IL")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean),
);

/**
 * Country → plausible IANA timezone prefixes. A visitor whose browser clock
 * sits in a wholly different region than their IP is the cheapest reliable
 * VPN tell available without a paid IP-intelligence feed.
 *
 * Deliberately coarse: this produces "suspected", never "blocked", because
 * travellers and expats trip it legitimately.
 */
const COUNTRY_TZ_REGION: Record<string, string[]> = {
  AE: ["Asia/Dubai"], SA: ["Asia/Riyadh"], IT: ["Europe/Rome"], DE: ["Europe/Berlin"],
  FR: ["Europe/Paris"], ES: ["Europe/Madrid"], PT: ["Europe/Lisbon"], NL: ["Europe/Amsterdam"],
  GB: ["Europe/London"], IE: ["Europe/Dublin"], US: ["America/"], CA: ["America/"],
  BR: ["America/"], MX: ["America/"], RU: ["Europe/Moscow", "Asia/"], TR: ["Europe/Istanbul"],
  IN: ["Asia/Kolkata"], JP: ["Asia/Tokyo"], AU: ["Australia/"], SG: ["Asia/Singapore"],
  MT: ["Europe/Malta"], CY: ["Asia/Nicosia", "Europe/Nicosia"], CH: ["Europe/Zurich"],
};

function timezoneMismatch(country: string, tz: string): boolean {
  const expected = COUNTRY_TZ_REGION[country.toUpperCase()];
  if (!expected) return false; // unknown mapping → no signal, not a violation
  return !expected.some((prefix) => tz.startsWith(prefix));
}

/**
 * Combine the available signals into a verdict.
 *
 * Deliberate policy: a *blocked jurisdiction* is decided on the IP country
 * alone, because that is the licensing fact. VPN heuristics only ever raise
 * "suspected" — they inform KYC and withdrawal review rather than locking a
 * player out on a guess, which is the behaviour that generates false-positive
 * support tickets and chargebacks.
 */
export function assessVpn(signals: GeoSignals): VpnAssessment {
  const reasons: string[] = [];
  const country = signals.country?.toUpperCase() ?? null;

  if (!country) {
    return { verdict: "unknown", reasons: ["no geo country from edge"], country: null };
  }

  if (BLOCKED_COUNTRIES.has(country)) {
    reasons.push(`restricted jurisdiction: ${country}`);
    return { verdict: "blocked", reasons, country };
  }

  if (signals.edgeProxyFlag) reasons.push("edge flagged address as proxy/relay");

  if (signals.clientTimezone && timezoneMismatch(country, signals.clientTimezone)) {
    reasons.push(`timezone ${signals.clientTimezone} inconsistent with ${country}`);
  }

  if (reasons.length > 0) return { verdict: "suspected", reasons, country };
  return { verdict: "clear", reasons: [], country };
}
