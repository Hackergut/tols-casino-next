import type { NextConfig } from "next";

/*
 * Security response headers.
 *
 * A gambling site is a high-value target for clickjacking (an invisible frame
 * over the bet button), for MIME-sniffing uploads into scripts, and for
 * referrer leakage of session-bearing URLs. These are the platform-wide
 * defaults; nothing here replaces the per-route auth and rate limiting.
 */
// Telegram embeds a Mini App inside an iframe on Web and Desktop, served from
// web.telegram.org (webk/webz/weba all live under *.telegram.org). Blocking all
// framing therefore blanks the app inside Telegram — so framing is allowed for
// Telegram's origins and nothing else, which keeps clickjacking protection
// against every other site intact.
const TELEGRAM_FRAME_ANCESTORS = "'self' https://web.telegram.org https://*.telegram.org";

// Governance Tower ↔ Casino: TWO SEPARATE VERCEL PROJECTS on subdomains
//   Casino = https://www.tols.fun  (this repo)
//   Governance = https://gov.tols.fun (another repo, another Vercel project)
// The bridge is service-to-service, not via the admin panel. CSP/CORS must allow the subdomain to call the Casino.
const TOWER_ORIGIN = (
  process.env.GOVERNANCE_TOWER_URL ||
  process.env.TOWER_URL ||
  process.env.TOLS_BASE_URL ||
  "https://gov.tols.fun"
).replace(/\/api\/?$/, "");
let TOWER_HOST: string | null = null;
try { TOWER_HOST = new URL(TOWER_ORIGIN).origin; } catch { TOWER_HOST = null; }
const BRIDGE_ANCESTORS = TOWER_HOST ? ` ${TOWER_HOST}` : "";
const BRIDGE_CONNECT = TOWER_HOST ? ` ${TOWER_HOST}` : "";
// .tols.fun subdomains: add a wildcard for Vercel previews (*.vercel.app) if needed

const securityHeaders = [
  // NOTE: X-Frame-Options is deliberately omitted. It is all-or-nothing
  // (ALLOW-FROM is dead in modern browsers) so it cannot express "Telegram
  // only"; CSP `frame-ancestors` below does the same job with an allowlist and
  // supersedes X-Frame-Options where both are understood.
  // Trust declared content types instead of sniffing them.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin only, and never to plain HTTP.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // No use for these APIs — deny them so an injected script cannot ask.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Force HTTPS for a year once served over TLS.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Defence in depth against injected script. 'unsafe-inline'/'unsafe-eval'
  // remain because Next's dev runtime and the games' inline styles need them —
  // tightening these to nonces is the next step for production.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      /*
       * Each directive may appear ONCE. CSP resolves a repeated directive by
       * keeping the FIRST and discarding the rest, so the duplicate
       * `frame-src https:` and `connect-src 'self' https://api.telegram.org`
       * that used to follow these lines were dead: the narrower earlier copies
       * won. That silently re-broke the vendor-game iframes the wider
       * `frame-src https:` was added to fix. Merged into one directive each.
       */
      `connect-src 'self' https://api.telegram.org${BRIDGE_CONNECT} https://*.vercel.app`,
      // Telegram frames the Mini App; the Tower subdomain frames nothing but is
      // allowed for the bridge. Everything else is refused.
      `frame-ancestors ${TELEGRAM_FRAME_ANCESTORS}${BRIDGE_ANCESTORS}`,
      // `https:` covers the EuroVirtuals aggregator, whose games each load from
      // their own studio domain and cannot be enumerated ahead of time.
      "frame-src https:",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // `standalone` is for self-hosting behind your own server. Vercel builds its
  // own serverless output, so the option is scoped to non-Vercel builds only.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  typescript: {
    // Type errors should fail a deploy, not ship. Kept lenient locally.
    ignoreBuildErrors: !process.env.VERCEL,
  },
  reactStrictMode: false,
  // Arena/E2B proxies the local dev server through a generated subdomain.
  // Production is unaffected; this only permits Next's development assets.
  allowedDevOrigins: ["*.e2b.app"],
  turbopack: {},
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Bridge + Platform APIs must be callable cross-origin from the Tower subdomain
      {
        source: "/api/bridge/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TOWER_HOST || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS,HEAD" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Bridge-Signature, X-Webhook-Signature, X-Tower-Signature, X-Governance-Signature, X-Cron-Secret, X-Api-Key, X-App-Key" },
          { key: "Access-Control-Max-Age", value: "86400" },
          { key: "Vary", value: "Origin" },
        ],
      },
      {
        source: "/api/platform/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: TOWER_HOST || "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS,HEAD" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
          { key: "Access-Control-Max-Age", value: "86400" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
