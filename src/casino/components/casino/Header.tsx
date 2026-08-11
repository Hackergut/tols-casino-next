"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Wallet, ArrowDownToLine, User, Menu, X, Trophy, Search, Bell, ChevronDown, Volume2, VolumeX, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JackpotTicker } from "./JackpotTicker";
import { NotificationsBell } from "./NotificationsBell";
import { PostedAmount } from "./PostedAmount";
import { springs } from "@/casino/lib/motion";
import { useSessionStore, useUIStore } from "@/lib/store";
import { toast } from "sonner";
import { useSound } from "@/hooks/use-sound";
import { formatCurrency } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SessionData {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
  level: number;
  xp: number;
  isAuthenticated?: boolean;
  wallet: { balance: number; currency: string; vipLevel: number } | null;
  affiliate: { referralCode: string } | null;
}

const NAV_ITEMS = [
  { id: "lobby", label: "Casino" },
  { id: "originals", label: "Originals" },
  { id: "slots", label: "Slots" },
  { id: "live", label: "Live" },
  { id: "tournaments", label: "Tournaments" },
  { id: "winners", label: "Winners" },
  { id: "marketplace", label: "Marketplace" },
];

/** Crypto token brand colors — the one place non-palette color is allowed. */
const TOKEN_COLORS: Record<string, string> = {
  USDT: "#26a17b",
  USDC: "#2775ca",
  BTC: "#f7931a",
  ETH: "#627eea",
  SOL: "#9945ff",
  LTC: "#345d9d",
};

export function Header() {
  const reduced = useReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeSection, setActiveSection, setDepositOpen, setSearchOpen, setAuthOpen } = useUIStore();
  const { balance, setWallet } = useSessionStore();
  const qc = useQueryClient();
  const { enabled: soundOn, toggle: toggleSound } = useSound();
  const [currency, setCurrency] = useState<string>("USDT");

  const { data: session } = useQuery<SessionData>({
    queryKey: ["session"],
    queryFn: async () => {
      const r = await fetch("/api/session");
      const j = await r.json();
      return j.data;
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (session?.wallet) {
      setWallet({
        balance: session.wallet.balance,
        currency: session.wallet.currency,
        vipLevel: session.wallet.vipLevel,
      });
      setCurrency(session.wallet.currency);
    }
    if (session) {
      useSessionStore.setState({
        user: {
          id: session.id,
          username: session.username,
          email: session.email,
          avatarColor: session.avatarColor,
          level: session.level,
        },
      });
    }
  }, [session, setWallet]);

  const switchCurrency = (c: string) => {
    setCurrency(c);
    if (session?.wallet) {
      setWallet({ balance: session.wallet.balance, currency: c, vipLevel: session.wallet.vipLevel });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 items-center gap-3 px-3 sm:px-4 lg:px-6">
        {/* Logo */}
        <button
          onClick={() => setActiveSection("lobby")}
          className="btn-press flex shrink-0 items-center gap-2"
          aria-label="TOLS Gaming home"
        >
          <div className="relative flex h-9 w-9 items-center justify-center rounded-md border border-lime/40">
            <span className="text-lg font-bold leading-none text-lime">T</span>
            <div className="pulse-glow absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-lime" />
          </div>
          <div className="hidden flex-col leading-none sm:flex">
            <span className="text-lg font-bold tracking-wider text-lime">TOLS</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Gaming</span>
          </div>
        </button>

        {/* Desktop nav */}
        <nav className="ml-2 hidden items-center gap-0.5 lg:flex">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-[var(--dur-fast)] ${
                activeSection === item.id
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
              {activeSection === item.id && (
                <motion.span
                  layoutId="nav-underline"
                  transition={reduced ? { duration: 0 } : springs.snappy}
                  className="absolute inset-x-2 -bottom-[1px] h-0.5 rounded-full bg-lime"
                />
              )}
            </button>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Search button (mobile icon + desktop bar) */}
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-press flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime md:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          onClick={() => setSearchOpen(true)}
          className="btn-press hidden items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-lime/40 md:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search…</span>
          <kbd className="ml-2 rounded border border-border/60 bg-background/60 px-1 font-mono text-[9px]">⌘K</kbd>
        </button>

        {/* Notifications bell */}
        <NotificationsBell />

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="btn-press flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-lime/40 hover:text-lime"
          aria-label={soundOn ? "Mute sounds" : "Enable sounds"}
          title={soundOn ? "Mute sounds" : "Enable sounds"}
        >
          {soundOn ? <Volume2 className="h-4 w-4 text-lime" /> : <VolumeX className="h-4 w-4" />}
        </button>

        {/* Jackpot ticker (hidden on small) */}
        <div className="hidden xl:block">
          <JackpotTicker amount={184521} compact />
        </div>

        {/* Wallet + actions */}
        {session?.wallet && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/60 p-1 pl-2">
            {/* Currency switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="btn-press flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-secondary/60"
                  aria-label="Switch currency"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: TOKEN_COLORS[currency] ?? "var(--color-lime)" }} />
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">{currency}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 border-border/60 bg-popover/95 backdrop-blur-xl">
                {Object.keys(TOKEN_COLORS).map((c) => (
                  <DropdownMenuItem key={c} onClick={() => switchCurrency(c)} className="gap-2 font-mono text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: TOKEN_COLORS[c] }} />
                    {c}
                    {c === currency && <span className="ml-auto text-lime">●</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="hidden flex-col items-end leading-none sm:flex">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</span>
              <PostedAmount value={balance} format={formatCurrency} className="text-sm font-bold text-lime" />
            </div>
            <button
              onClick={() => setDepositOpen(true)}
              className="btn-press flex h-8 w-8 items-center justify-center rounded-md bg-lime/10 text-lime transition-colors hover:bg-lime/20"
              title="Deposit"
              aria-label="Deposit"
            >
              <ArrowDownToLine className="h-4 w-4" />
            </button>
          </div>
        )}

        <Button
          onClick={() => setDepositOpen(true)}
          size="sm"
          className="btn-press hidden h-9 rounded-md bg-lime text-sm font-semibold uppercase tracking-wide text-bg shadow-[0_0_20px] shadow-lime/25 transition-all hover:bg-lime-200 hover:shadow-[0_0_30px] hover:shadow-lime/40 sm:flex"
        >
          <Wallet className="mr-1.5 h-4 w-4" />
          Wallet
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="btn-press flex items-center gap-2 rounded-full border border-border/60 bg-card/60 p-1 pr-2 transition-colors hover:border-lime/40">
              <Avatar className="h-7 w-7 border border-border/40">
                <AvatarFallback style={{ background: session?.avatarColor || "var(--color-lime)", color: "var(--color-bg)" }} className="text-xs font-bold">
                  {session?.username?.slice(0, 2).toUpperCase() || "TP"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start leading-none md:flex">
                <span className="text-xs font-semibold">{session?.username || "TOLSPlayer"}</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Lvl {session?.level || 1}</span>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground md:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 border-border/60 bg-popover/95 backdrop-blur-xl">
            <DropdownMenuLabel className="tracking-wide">
              <div className="flex flex-col">
                <span>{session?.username || "TOLSPlayer"}</span>
                <span className="text-[10px] font-normal text-muted-foreground">{session?.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveSection("wallet")}>
              <Wallet className="mr-2 h-4 w-4" /> Wallet
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveSection("profile")}>
              <User className="mr-2 h-4 w-4" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveSection("affiliate")}>
              <User className="mr-2 h-4 w-4" /> Affiliate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setActiveSection("history")}>
              <Trophy className="mr-2 h-4 w-4" /> My Bets
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {session?.isAuthenticated ? (
              <DropdownMenuItem
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  useSessionStore.getState().logout();
                  qc.invalidateQueries();
                  toast.success("Signed out");
                }}
                className="text-loss"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setAuthOpen(true)} className="text-lime">
                <LogIn className="mr-2 h-4 w-4" /> Sign in / Register
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="btn-press flex h-9 w-9 items-center justify-center rounded-md border border-border/60 text-foreground lg:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={reduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, y: -8 }}
            transition={reduced ? { duration: 0 } : springs.soft}
            className="border-t border-border/60 bg-background/95 backdrop-blur-xl lg:hidden"
          >
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-3 py-3">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    setMobileOpen(false);
                  }}
                  className={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                    item.id === activeSection ? "bg-lime/10 text-lime" : "text-muted-foreground hover:bg-secondary/40"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
