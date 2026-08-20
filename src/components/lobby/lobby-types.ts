// Lobby shell shared types, constants and utilities — extracted from page.tsx (Phase 2).
import type { LucideIcon } from "lucide-react";
import {
  TrendingUp, Gamepad2, Zap, CircleDot, Sparkles, RotateCcw, Crown, Crosshair,
  HomeIcon, Flame, Radio, LayoutGrid, Clock, Club, Disc, Gem,
} from "lucide-react";

export interface LobbyGame {
  id: string;
  slug: string;
  name: string;
  provider: string;
  category: string;
  imageUrl: string;
  thumbnailUrl: string;
  rtp: number | null;
  volatility: string | null;
  isLive: boolean;
  isNew: boolean;
  featured: boolean;
  description: string | null;
  gameType: string;
  popularity: number;
}

export interface LiveBet {
  id: string;
  gameName: string;
  gameCategory: string;
  amount: number;
  multiplier: number;
  payout: number;
  result: string;
  createdAt: string;
  username: string;
  avatarColor: string;
}

export interface CasinoStats {
  totalBets: number;
  totalWagered: number;
  houseProfit: number;
  jackpot: number;
  onlinePlayers: number;
  totalPlayers: number;
}

export interface OriginalGameDef {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  desc: string;
  rtp: number;
  isNew?: boolean;
}

export const ORIGINAL_GAMES: OriginalGameDef[] = [
  { id: "crash", name: "Crash", icon: TrendingUp, color: "#cdf32b", desc: "Watch the multiplier rise — cash out before it crashes!", rtp: 99 },
  { id: "dice", name: "Dice", icon: Gamepad2, color: "#cdf32b", desc: "Roll over or under your target number for big multipliers.", rtp: 99 },
  { id: "mines", name: "Mines", icon: Zap, color: "#cdf32b", desc: "Reveal safe tiles and avoid the mines.", rtp: 99 },
  { id: "wheel", name: "Wheel", icon: CircleDot, color: "#cdf32b", desc: "Spin the wheel for up to 9.9x multipliers.", rtp: 97 },
  { id: "keno", name: "Keno", icon: Sparkles, color: "#cdf32b", desc: "Pick 1-10 numbers from 40. Match 10 draws to win!", rtp: 96 },
  { id: "limbo", name: "Limbo", icon: TrendingUp, color: "#cdf32b", desc: "Set your target multiplier — instant result.", rtp: 99 },
  { id: "plinko", name: "Plinko", icon: RotateCcw, color: "#cdf32b", desc: "Drop the ball and watch it bounce to a win!", rtp: 97 },
  { id: "coinflip", name: "Coinflip", icon: Crown, color: "#cdf32b", desc: "Pick heads or tails — 1.98x payout.", rtp: 99 },
  { id: "shoot", name: "Target Shoot", icon: Crosshair, color: "#cdf32b", desc: "Shoot a target and reveal its multiplier!", rtp: 97 },
  { id: "slots", name: "Slots", icon: Sparkles, color: "#cdf32b", desc: "Spin the reels — match symbols on the payline!", rtp: 97 },
  { id: "roulette", name: "Roulette", icon: CircleDot, color: "#cdf32b", desc: "European single-zero — bet numbers, colours, and more!", rtp: 97.3 },
  { id: "blackjack", name: "Blackjack", icon: Club, color: "#cdf32b", desc: "Classic 21 — hit, stand or double. Blackjack pays 3:2.", rtp: 99.5, isNew: true },
  { id: "pool-rush", name: "Pool Rush", icon: Disc, color: "#cdf32b", desc: "Break the rack — pocket more balls for bigger multipliers.", rtp: 96.3, isNew: true },
  { id: "scopa", name: "Scopa", icon: Gem, color: "#cdf32b", desc: "Mini-scopa vs the house — capture, scopa, settebello.", rtp: 97, isNew: true },
];

export const ORIGINAL_IDS = new Set(ORIGINAL_GAMES.map((g) => g.id));

export function originalArtUrl(id: string): string {
  return `/games/originals/${id}.jpg`;
}

export function originalArtCandidates(id: string, extra?: string | null): string[] {
  const urls = [
    `/games/originals/${id}.jpg`,
    `/games/originals/${id}.png`,
    `/games/originals/${id}.svg`,
  ];
  if (extra && !urls.includes(extra)) urls.push(extra);
  return urls;
}

export function originalToLobbyGame(g: OriginalGameDef): LobbyGame {
  const art = originalArtUrl(g.id);
  return {
    id: g.id,
    slug: g.id,
    name: g.name,
    provider: "TOLS",
    category: "originals",
    imageUrl: art,
    thumbnailUrl: art,
    rtp: g.rtp,
    volatility: "medium",
    isLive: false,
    isNew: Boolean(g.isNew),
    featured: true,
    description: g.desc,
    gameType: "original",
    popularity: g.isNew ? 88 : 80,
  };
}

/** Catalogue originals + the 14 TOLS Originals, in a stable shelf order. */
export function mergeOriginals(apiGames: LobbyGame[]): LobbyGame[] {
  const fromApi = apiGames.filter((g) => g.gameType === "original");
  const bySlug = new Map(fromApi.map((g) => [g.slug, g]));
  const ordered = ORIGINAL_GAMES.map((def) => {
    const existing = bySlug.get(def.id);
    const fallback = originalToLobbyGame(def);
    if (existing) bySlug.delete(def.id);
    if (!existing) return fallback;
    return {
      ...existing,
      name: existing.name || fallback.name,
      provider: "TOLS",
      category: "originals",
      gameType: "original",
      imageUrl: fallback.imageUrl,
      thumbnailUrl: fallback.thumbnailUrl,
      rtp: existing.rtp ?? fallback.rtp,
      isNew: existing.isNew || fallback.isNew,
      description: existing.description || fallback.description,
      featured: true,
    };
  });
  const extra = [...bySlug.values()].map((g) => ({
    ...g,
    imageUrl: g.imageUrl.replace(/\.(png|svg)$/i, ".jpg"),
  }));
  return [...ordered, ...extra];
}

export const NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "lobby", label: "Lobby", icon: HomeIcon },
  { id: "originals", label: "Originals", icon: Flame },
  { id: "slots", label: "Slots", icon: Gamepad2 },
  { id: "live", label: "Live Casino", icon: Radio },
  { id: "table", label: "Table Games", icon: LayoutGrid },
  { id: "recent", label: "Recent", icon: Clock },
];

export const CATEGORY_TABS = ["All", "Popular", "New", "Slots", "Originals", "Live"];

export function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(n % 1 === 0 ? 0 : 2);
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
