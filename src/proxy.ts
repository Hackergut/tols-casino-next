import { NextRequest, NextResponse } from "next/server";
import { resolveLocale } from "@/lib/i18n";
import { assessVpn } from "@/lib/compliance";
import { isCasinoAppPath } from "@/lib/casino-routes";

/*
 * Edge pass on every page request. Two jobs:
 *
 * 1. Region → language. Resolve the visitor's locale from their geo IP country
 *    (Vercel's x-vercel-ip-country), then Accept-Language, then default —
 *    unless they've already chosen one (the `locale` cookie wins). Persisted so
 *    it's stable, and exposed as `x-locale` for the server components.
 *
 * 2. Jurisdiction + VPN assessment. Done here rather than in the page because
 *    the geo headers only exist at the edge, and because the layout needs the
 *    verdict during SSR to render the gate on the first paint — a client-side
 *    check would flash the lobby before covering it.
 */
export function proxy(req: NextRequest) {
  const existing = req.cookies.get("locale")?.value ?? null;
  const country = req.headers.get("x-vercel-ip-country");
  const locale = resolveLocale({
    cookie: existing,
    country,
    acceptLanguage: req.headers.get("accept-language"),
  });

  // Vercel's edge network does not expose a proxy/VPN flag on the standard
  // plan, so the only server-side signal is the country itself. The timezone
  // half of the heuristic is contributed by the client (see VpnNotice) — the
  // browser is the only party that knows its own clock.
  const assessment = assessVpn({
    country,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    edgeProxyFlag: false,
  });

  // Forward on the REQUEST headers, not the response: server components read
  // the incoming request via headers(). Setting these on the response would
  // only ship them to the browser, where nothing reads them.
  const forwarded = new Headers(req.headers);
  forwarded.set("x-locale", locale);
  forwarded.set("x-geo-country", assessment.country ?? "");
  forwarded.set("x-geo-verdict", assessment.verdict);

  // The casino is a client-routed shell, but every public screen also has a
  // durable URL. Rewrite known app paths to the shell while preserving the
  // visible pathname, so refresh, deep links and browser Back all work.
  const appDeepLink = req.nextUrl.pathname !== "/" && isCasinoAppPath(req.nextUrl.pathname);
  const res = appDeepLink
    ? NextResponse.rewrite(new URL("/", req.url), { request: { headers: forwarded } })
    : NextResponse.next({ request: { headers: forwarded } });

  // `locale` is reserved for an explicit language-picker choice. Automatic
  // geo detection must be recalculated when the player changes country, so it
  // is observed separately instead of being frozen for a year.
  if (!existing) {
    res.cookies.set("locale_detected", locale, {
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
    });
  }

  return res;
}

// Run on pages only — skip API routes, Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/|api/|.*\\.[\\w]+$).*)"],
};
