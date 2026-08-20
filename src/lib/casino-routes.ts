import type { OriginalId } from "@/lib/originals-registry";

export const ORIGINAL_IDS = new Set<OriginalId>([
  "dice", "crash", "limbo", "coinflip", "plinko", "mines", "wheel", "keno", "shoot", "poolrush", "blackjack", "slots", "roulette",
]);
export const PROFILE_ROUTE_SECTIONS = new Set([
  "wallet", "vip", "vault", "token", "affiliate", "notifications", "transactions",
  "redeem", "settings", "play-responsibly", "live-support", "rewards",
  "promotions", "challenges",
]);
export interface CasinoRoute { section: string; game: OriginalId | null }

/*
 * Per-promotion info pages. Every public promo card routes to /promo/{id} so
 * it can show its own detail page (hero art + terms + CTA). Internally the
 * section id is namespaced "promo:{id}" so it can never collide with a game
 * slug or a profile section.
 */
export const PROMO_ROUTE_PREFIX = "promo:";
export function isPromoRouteSection(section: string): boolean {
  return section.startsWith(PROMO_ROUTE_PREFIX);
}
export function promoSection(id: string): string {
  return `${PROMO_ROUTE_PREFIX}${id}`;
}
export function promoIdFromSection(section: string): string {
  return section.slice(PROMO_ROUTE_PREFIX.length);
}

export function parseCasinoRoute(pathname: string): CasinoRoute {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length || parts[0] === "casino" || parts[0] === "home") return { section: "lobby", game: null };
  if (parts[0] === "originals") {
    const candidate = parts[1] as OriginalId | undefined;
    return { section: "originals", game: candidate && ORIGINAL_IDS.has(candidate) ? candidate : null };
  }
  if (parts[0] === "leaderboards" || parts[0] === "rewards") return { section: "rewards", game: null };
  if (parts[0] === "games" && ["slots", "live", "table", "recent"].includes(parts[1])) return { section: parts[1], game: null };
  if (parts[0] === "promo" && parts[1]) return { section: promoSection(parts[1]), game: null };
  if (parts[0] === "account" && PROFILE_ROUTE_SECTIONS.has(parts[1])) return { section: parts[1], game: null };
  return { section: "lobby", game: null };
}

export function casinoPath(section: string, game?: string | null): string {
  if (game && ORIGINAL_IDS.has(game as OriginalId)) return `/originals/${encodeURIComponent(game)}`;
  if (section === "lobby") return "/";
  if (section === "originals") return "/originals";
  if (section === "rewards") return "/leaderboards";
  if (["slots", "live", "table", "recent"].includes(section)) return `/games/${section}`;
  if (isPromoRouteSection(section)) return `/promo/${encodeURIComponent(promoIdFromSection(section))}`;
  if (PROFILE_ROUTE_SECTIONS.has(section)) return `/account/${encodeURIComponent(section)}`;
  return "/";
}

export function isCasinoAppPath(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0];
  return !first || ["casino", "home", "originals", "leaderboards", "rewards", "games", "promo", "account"].includes(first);
}
