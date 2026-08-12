import { NextRequest, NextResponse } from "next/server";
import { resolveLocale } from "@/lib/i18n";

/*
 * Region → language. On every page request, resolve the visitor's locale from
 * their geo IP country (Vercel's x-vercel-ip-country), then the browser's
 * Accept-Language, then default — unless they've already chosen one (the
 * `locale` cookie wins). The choice is persisted so it's stable, and exposed as
 * `x-locale` for the server components that render the page.
 */
export function proxy(req: NextRequest) {
  const res = NextResponse.next();

  const existing = req.cookies.get("locale")?.value ?? null;
  const locale = resolveLocale({
    cookie: existing,
    country: req.headers.get("x-vercel-ip-country"),
    acceptLanguage: req.headers.get("accept-language"),
  });

  if (existing !== locale) {
    res.cookies.set("locale", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  res.headers.set("x-locale", locale);
  return res;
}

// Run on pages only — skip API routes, Next internals and static assets.
export const config = {
  matcher: ["/((?!_next/|api/|.*\\.[\\w]+$).*)"],
};
