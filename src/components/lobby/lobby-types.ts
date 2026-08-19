// Lobby shell shared types, constants and utilities — extracted from page.tsx (Phase 2).
import type { LucideIcon } from "lucide-react";
import {
  TrendingUp, Gamepad2, Zap, CircleDot, Sparkles, RotateCcw, Crown, Crosshair,
  HomeIcon, Flame, Radio, LayoutGrid, Clock, Club,
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
  { id: "slots", name: "Slots", icon: Sparkles, color: "#ccff00", desc: "Spin the reels — match symbols on the payline!" },
  { id: "roulette", name: "Roulette", icon: CircleDot, color: "#e0322f", desc: "European single-zero — bet numbers, colours, and more!" },
  { id: "blackjack", name: "Blackjack", icon: Club, color: "#22c55e", desc: "Classic 21 — hit, stand or double. Blackjack pays 3:2." },
];

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
