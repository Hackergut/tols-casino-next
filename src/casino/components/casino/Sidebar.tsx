"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  Dices, Rocket, CircleDot, Bomb, TrendingUp, Coins, Disc, Grid3x3, Swords,
  Gamepad2, Radio, Spade, Store, Trophy, Users, Wallet, Crown, Flame, Sparkles, Gift, Package, History, Shield, BarChart3, Target, Key,
  ChevronsLeft, ChevronsRight
} from "lucide-react";
import { useUIStore } from "@/lib/store";
import { springs } from "@/casino/lib/motion";
import { DailyStreakWidget } from "./DailyStreakWidget";

interface Game {
  id: string; slug: string; name: string; category: string; image: string; provider: string;
}

const SIDEBAR_GROUPS = [
  {
    title: "TOLS Originals",
    icon: Flame,
    games: [
      { slug: "dice", name: "Dice", icon: Dices },
      { slug: "crash", name: "Crash", icon: Rocket },
      { slug: "plinko", name: "Plinko", icon: CircleDot },
      { slug: "mines", name: "Mines", icon: Bomb },
      { slug: "limbo", name: "Limbo", icon: TrendingUp },
      { slug: "coinflip", name: "Coin Flip", icon: Coins },
      { slug: "wheel", name: "Wheel", icon: Disc },
      { slug: "keno", name: "Keno", icon: Grid3x3 },
      { slug: "scopa", name: "Scopa", icon: Swords },
    ],
  },
];

const QUICK_LINKS = [
  { id: "lobby", label: "Casino Lobby", icon: Gamepad2 },
  { id: "promotions", label: "Promotions", icon: Gift },
  { id: "challenges", label: "Daily Challenges", icon: Target },
  { id: "vip", label: "VIP Club", icon: Crown },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "stats", label: "Game Stats", icon: BarChart3 },
  { id: "social", label: "Social Feed", icon: Users },
  { id: "slots", label: "Slot Games", icon: Spade },
  { id: "live", label: "Live Casino", icon: Radio },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "winners", label: "Biggest Wins", icon: TrendingUp },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "packs", label: "Card Packs", icon: Sparkles },
  { id: "collection", label: "My Collection", icon: Package },
  { id: "history", label: "Bet History", icon: History },
  { id: "affiliate", label: "Affiliate", icon: Users },
  { id: "profile", label: "My Profile", icon: Users },
  { id: "wallet", label: "My Wallet", icon: Wallet },
  { id: "responsible", label: "Responsible Gaming", icon: Shield },
  { id: "apikeys", label: "API Keys", icon: Key },
];

export function Sidebar({ onSelectGame }: { onSelectGame: (slug: string) => void }) {
  const { activeSection, setActiveSection } = useUIStore();
  const [collapsed, setCollapsed] = useState(false);
  const reduced = useReducedMotion();

  const { data: games } = useQuery<Game[]>({
    queryKey: ["games", "originals"],
    queryFn: async () => {
      const r = await fetch("/api/games?category=originals");
      const j = await r.json();
      return j.data;
    },
  });

  return (
    <motion.aside
      // width is the one sanctioned non-transform animation: a collapse cannot
      // be expressed as a transform without distorting content. Single element.
      animate={{ width: collapsed ? 68 : 240 }}
      transition={reduced ? { duration: 0 } : springs.soft}
      className="sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col overflow-hidden border-r border-border/40 bg-sidebar/40 lg:flex"
      style={{ width: 240 }}
    >
      <div className={`flex items-center px-2 pt-3 ${collapsed ? "justify-center" : "justify-end"}`}>
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="btn-press flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
        >
          {collapsed ? <ChevronsRight className="h-3.5 w-3.5" /> : <ChevronsLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {/* Quick links */}
        <div className="mb-4">
          {!collapsed && (
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Menu</p>
          )}
          <nav className="space-y-0.5">
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`group relative flex w-full items-center gap-2.5 rounded-md py-2 text-sm transition-colors duration-[var(--dur-fast)] ${
                    collapsed ? "justify-center px-0" : "px-2.5"
                  } ${active ? "text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"}`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active"
                      transition={reduced ? { duration: 0 } : springs.snappy}
                      className="absolute inset-0 rounded-md bg-lime/10"
                    >
                      <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-lime" />
                    </motion.span>
                  )}
                  <Icon className={`relative z-10 h-4 w-4 shrink-0 ${active ? "text-lime" : ""}`} />
                  {!collapsed && <span className="relative z-10 truncate font-medium">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Originals */}
        {SIDEBAR_GROUPS.map((group) => {
          const GroupIcon = group.icon;
          return (
            <div key={group.title} className="mb-4">
              <div className={`flex items-center gap-1.5 px-2 pb-1.5 ${collapsed ? "justify-center px-0" : ""}`}>
                <GroupIcon className="h-3.5 w-3.5 text-lime" />
                {!collapsed && (
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{group.title}</p>
                )}
              </div>
              <nav className="space-y-0.5">
                {group.games.map((g) => {
                  const Icon = g.icon;
                  return (
                    <button
                      key={g.slug}
                      onClick={() => onSelectGame(g.slug)}
                      title={collapsed ? g.name : undefined}
                      className={`group flex w-full items-center gap-2.5 rounded-md py-2 text-sm text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:bg-secondary/50 hover:text-foreground ${
                        collapsed ? "justify-center px-0" : "px-2.5"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-lime" />
                      {!collapsed && <span className="truncate font-medium">{g.name}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
          );
        })}

        {!collapsed && (
          <>
            {/* VIP / promo box */}
            <div className="mt-6 rounded-lg border border-vip/30 bg-gradient-to-br from-vip/10 to-transparent p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <Crown className="h-4 w-4 text-vip" />
                <span className="text-sm font-semibold uppercase tracking-wide">VIP Club</span>
              </div>
              <p className="mb-2 text-xs text-muted-foreground">Climb tiers for rakeback, weekly bonuses &amp; a dedicated host.</p>
              <button className="btn-press w-full rounded-md border border-vip/50 py-1.5 text-xs font-semibold uppercase tracking-wide text-vip transition-colors hover:bg-vip/10">
                View Tiers
              </button>
            </div>

            {/* Daily streak widget */}
            <div className="mt-3">
              <DailyStreakWidget />
            </div>
          </>
        )}
      </div>
    </motion.aside>
  );
}
