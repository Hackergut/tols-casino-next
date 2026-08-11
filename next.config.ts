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
      "connect-src 'self' https://api.telegram.org",
      `frame-ancestors ${TELEGRAM_FRAME_ANCESTORS}`,
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
  turbopack: {},
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
