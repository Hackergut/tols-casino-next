// Lobby shell shared types, constants and utilities — extracted from page.tsx (Phase 2).
import type { LucideIcon } from "lucide-react";
import {
  TrendingUp, Gamepad2, Zap, CircleDot, Sparkles, RotateCcw, Crown, Crosshair,
  HomeIcon, Flame, Radio, LayoutGrid, Clock, Trophy,
} from "lucide-react";
import { getOriginal, type OriginalId } from "@/lib/originals-registry";

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

/*
 * Names and descriptions come from the Originals registry — the same source
 * the game frames and lobby cards use. The previous hand-typed copy had
 * drifted from the games themselves: Coinflip advertised "1.98x payout"
 * while the server pays 1.88× (2 × TARGET_RTP at a 6% edge), and Keno said
 * "numbers from 80" while the game draws from 40. Only the presentation
 * bits (icon, accent colour) stay local.
 */
const ORIGINAL_STYLES: { id: OriginalId; icon: LucideIcon; color: string }[] = [
  { id: "crash", icon: TrendingUp, color: "#ef4444" },
  { id: "dice", icon: Gamepad2, color: "#3b82f6" },
  { id: "mines", icon: Zap, color: "#f59e0b" },
  { id: "wheel", icon: CircleDot, color: "#8b5cf6" },
  { id: "keno", icon: Sparkles, color: "#ec4899" },
  { id: "limbo", icon: TrendingUp, color: "#14b8a6" },
  { id: "plinko", icon: RotateCcw, color: "#f97316" },
  { id: "coinflip", icon: Crown, color: "#eab308" },
  { id: "shoot", icon: Crosshair, color: "#22d3ee" },
  { id: "poolrush", icon: CircleDot, color: "#35d07f" },
  { id: "slots", icon: Sparkles, color: "#ccff00" },
  { id: "roulette", icon: CircleDot, color: "#e0322f" },
];

export const ORIGINAL_GAMES: OriginalGameDef[] = ORIGINAL_STYLES.map(({ id, icon, color }) => {
  const meta = getOriginal(id);
  return {
    id,
    icon,
    color,
    name: meta?.name ?? id,
    desc: meta?.tagline ?? "",
  };
});

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
