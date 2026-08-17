'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useBalanceStore } from "@/lib/balance-store";

interface BalanceState {
  currency: string;
  loading: boolean;
  error: string | null;
}

/**
 * Reactive balance hook.
 * - Fetches the user's wallet balance on mount.
 * - Exposes `refresh()` for manual re-fetch (e.g. after a bet, deposit credit, withdrawal).
 * - Provides `optimisticDeduct(amount)` for instant UI feedback on bets.
 * - Auto-refreshes on visibility change (user tabs back) to catch background credits.
 */
/*
 * The withdrawal panel's balance was a THIRD independent copy of the same
 * number, fetched separately from /api/wallet. A player who bet in a game and
 * then opened the withdraw form was shown the balance as of whenever this hook
 * last fetched — so "Max" could request more than the wallet holds, and the
 * request would be rejected by the server for a figure the UI had just offered.
 * It now reads the shared store; only the currency and request state stay local.
 */
export function useBalance() {
  const balance = useBalanceStore((s) => s.balance);
  const [state, setState] = useState<BalanceState>({
    currency: "USDT",
    loading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchBalance = useCallback(async () => {
    const token = useBalanceStore.getState().begin();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/wallet", { signal: controller.signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to fetch balance (${res.status})`);
      }
      const json = await res.json();
      const data = json.data ?? json;
      // Tokenised: a bet settling while this request was in flight wins.
      useBalanceStore.getState().applyPoll(Number(data.balance ?? 0), token);
      setState({
        currency: data.currency ?? "USDT",
        loading: false,
        error: null,
      });
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((prev) => ({ ...prev, loading: false, error: e.message }));
    }
  }, []);

  // Auto-refresh on visibility change
  useEffect(() => {
    fetchBalance();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchBalance();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      abortRef.current?.abort();
    };
  }, [fetchBalance]);

  return {
    ...state,
    balance,
    refresh: fetchBalance,
  };
}
