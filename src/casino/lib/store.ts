"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SessionUser {
  id: string;
  username: string;
  email: string;
  avatarColor: string;
  level: number;
}

interface SessionState {
  user: SessionUser | null;
  balance: number;
  currency: string;
  vipLevel: number;
  totalWagered: number;
  // actions
  setUser: (u: SessionUser | null) => void;
  setBalance: (b: number) => void;
  adjustBalance: (delta: number) => void;
  /** Balance is intentionally absent: it lives in useBalanceStore, which
   *  orders writes so a stale poll cannot overwrite a settled bet. */
  setWallet: (w: { balance?: number; currency?: string; vipLevel?: number; totalWagered?: number }) => void;
  logout: () => void;
  hydrated: boolean;
  setHydrated: (h: boolean) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      balance: 1000,
      currency: "USDT",
      vipLevel: 1,
      totalWagered: 0,
      hydrated: false,
      setUser: (u) => set({ user: u }),
      setBalance: (b) => set({ balance: b }),
      adjustBalance: (delta) => set((s) => ({ balance: Math.max(0, s.balance + delta) })),
      setWallet: (w) =>
        set((s) => ({
          balance: w.balance ?? s.balance,
          currency: w.currency ?? s.currency,
          vipLevel: w.vipLevel ?? s.vipLevel,
          totalWagered: w.totalWagered ?? s.totalWagered,
        })),
      logout: () => set({ user: null, balance: 1000, currency: "USDT", vipLevel: 1, totalWagered: 0 }),
      setHydrated: (h) => set({ hydrated: h }),
    }),
    {
      name: "tols-session",
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

interface ToastEntry {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error";
}

// Generic UI store: active section, modals, jackpot ticker
interface UIState {
  activeSection: string;
  setActiveSection: (s: string) => void;
  depositOpen: boolean;
  setDepositOpen: (b: boolean) => void;
  authOpen: boolean;
  setAuthOpen: (b: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (b: boolean) => void;
  selectedGame: string | null;
  setSelectedGame: (s: string | null) => void;
  lastWin: { payout: number; multiplier: number; game: string; ts: number } | null;
  setLastWin: (w: { payout: number; multiplier: number; game: string } | null) => void;
  provablyFairOpen: boolean;
  setProvablyFairOpen: (b: boolean) => void;
  lastBet: { clientSeed: string; serverSeedHash: string; nonce: number } | null;
  setLastBet: (b: { clientSeed: string; serverSeedHash: string; nonce: number } | null) => void;
  searchOpen: boolean;
  setSearchOpen: (b: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeSection: "lobby",
  setActiveSection: (s) => set({ activeSection: s }),
  depositOpen: false,
  setDepositOpen: (b) => set({ depositOpen: b }),
  authOpen: false,
  setAuthOpen: (b) => set({ authOpen: b }),
  chatOpen: false,
  setChatOpen: (b) => set({ chatOpen: b }),
  selectedGame: null,
  setSelectedGame: (s) => set({ selectedGame: s }),
  lastWin: null,
  setLastWin: (w) => set({ lastWin: w ? { ...w, ts: Date.now() } : null }),
  provablyFairOpen: false,
  setProvablyFairOpen: (b) => set({ provablyFairOpen: b }),
  lastBet: null,
  setLastBet: (b) => set({ lastBet: b }),
  searchOpen: false,
  setSearchOpen: (b) => set({ searchOpen: b }),
}));
