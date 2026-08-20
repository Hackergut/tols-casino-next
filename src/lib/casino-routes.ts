import type { OriginalId } from "@/lib/originals-registry";

export const ORIGINAL_IDS = new Set<OriginalId>([
  "dice", "crash", "limbo", "coinflip", "plinko", "mines", "wheel", "keno", "shoot", "poolrush", "blackjack", "slots", "roulette",
]);
export const PROFILE_ROUTE_SECTIONS = new Set([
  "wallet", "vip", "cassaforte", "token", "affiliate", "notifications", "transactions",
  "riscatta-codice", "settings", "play-responsibly", "live-support",
]);
export interface CasinoRoute { section: string; game: OriginalId | null }

export function parseCasinoRoute(pathname: string): CasinoRoute {
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (!parts.length || parts[0] === "casino" || parts[0] === "home") return { section: "lobby", game: null };
  if (parts[0] === "originals") {
    const candidate = parts[1] as OriginalId | undefined;
    return { section: "originals", game: candidate && ORIGINAL_IDS.has(candidate) ? candidate : null };
  }
  if (parts[0] === "leaderboards" || parts[0] === "rewards") return { section: "rewards", game: null };
  if (parts[0] === "games" && ["slots", "live", "table", "recent"].includes(parts[1])) return { section: parts[1], game: null };
  if (parts[0] === "account" && PROFILE_ROUTE_SECTIONS.has(parts[1])) return { section: parts[1], game: null };
  return { section: "lobby", game: null };
}

export function casinoPath(section: string, game?: string | null): string {
  if (game && ORIGINAL_IDS.has(game as OriginalId)) return `/originals/${encodeURIComponent(game)}`;
  if (section === "lobby") return "/";
  if (section === "originals") return "/originals";
  if (section === "rewards") return "/leaderboards";
  if (["slots", "live", "table", "recent"].includes(section)) return `/games/${section}`;
  if (PROFILE_ROUTE_SECTIONS.has(section)) return `/account/${encodeURIComponent(section)}`;
  return "/";
}

export function isCasinoAppPath(pathname: string): boolean {
  const first = pathname.split("/").filter(Boolean)[0];
  return !first || ["casino", "home", "originals", "leaderboards", "rewards", "games", "account"].includes(first);
}
