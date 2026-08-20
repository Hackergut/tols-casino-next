// Lobby shell shared types, constants and utilities — extracted from page.tsx (Phase 2).
import type { LucideIcon } from "lucide-react";
import {
  TrendingUp, Gamepad2, Zap, CircleDot, Sparkles, RotateCcw, Crown, Crosshair,
  HomeIcon, Flame, Radio, LayoutGrid, Clock, Trophy, Swords,
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
  minBet?: number;
  maxBet?: number;
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
  rtp?: number;
  isNew?: boolean;
}

export const ORIGINAL_GAMES: OriginalGameDef[] = [
  { id: "crash", name: "Crash", icon: TrendingUp, color: "#ef4444", desc: "Watch the multiplier rise — cash out before it crashes!" },
  { id: "dice", name: "Dice", icon: Gamepad2, color: "#3b82f6", desc: "Roll over or under your target number for big multipliers." },
  { id: "mines", name: "Mines", icon: Zap, color: "#f59e0b", desc: "Reveal safe tiles and avoid the mines." },
  { id: "wheel", name: "Wheel", icon: CircleDot, color: "#8b5cf6", desc: "Spin the wheel for up to 9.9x multipliers." },
  { id: "keno", name: "Keno", icon: Sparkles, color: "#ec4899", desc: "Pick 1-10 numbers from 80. Match to win!" },
  { id: "limbo", name: "Limbo", icon: TrendingUp, color: "#14b8a6", desc: "Set your target multiplier — instant result." },
  { id: "plinko", name: "Plinko", icon: RotateCcw, color: "#f97316", desc: "Drop the ball and watch it bounce to a win!" },
  { id: "coinflip", name: "Coinflip", icon: Crown, color: "#eab308", desc: "Pick heads or tails — 1.98x payout." },
  { id: "shoot", name: "Target Shoot", icon: Crosshair, color: "#22d3ee", desc: "Shoot a target and reveal its multiplier!" },
  { id: "poolrush", name: "Pool Rush", icon: CircleDot, color: "#ccff00", desc: "Choose your break difficulty and sink up to seven balls." },
  { id: "blackjack", name: "Blackjack 1V1", icon: Crown, color: "#ccff00", desc: "Classic six-deck blackjack — beat the dealer to 21." },
  { id: "slots", name: "Slots", icon: Sparkles, color: "#ccff00", desc: "Spin the reels — match symbols on the payline!" },
  { id: "roulette", name: "Roulette", icon: CircleDot, color: "#e0322f", desc: "European single-zero — bet numbers, colours, and more!" },
  { id: "scopa", name: "Scopa Siciliana", icon: Swords, color: "#eab308", desc: "Bet on an automatic Sicilian Scopa round — provably fair." },
];

export const ORIGINAL_IDS = new Set(ORIGINAL_GAMES.map((g) => g.id));

export function originalArtUrl(id: string): string {
  const slug = id === "poolrush" ? "pool-rush" : id;
  return `/games/originals/${slug}.jpg`;
}

export function originalArtCandidates(id: string, extra?: string | null): string[] {
  const slug = id === "poolrush" ? "pool-rush" : id;
  const urls = [
    `/games/originals/${slug}.jpg`,
    `/games/originals/${id}.jpg`,
    `/games/originals/${slug}.png`,
    `/games/originals/${id}.png`,
    `/games/originals/${slug}.svg`,
    `/games/originals/${id}.svg`,
  ];
  if (extra && !urls.includes(extra)) urls.push(extra);
  return [...new Set(urls)];
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
    rtp: g.rtp ?? 99,
    volatility: "medium",
    isLive: false,
    isNew: Boolean(g.isNew),
    featured: true,
    description: g.desc,
    gameType: "original",
    popularity: g.isNew ? 88 : 80,
  };
}

export const NAV_ITEMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "lobby", label: "Home", icon: HomeIcon },
  { id: "originals", label: "Originals", icon: Flame },
  { id: "rewards", label: "Leaderboards", icon: Trophy },
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
