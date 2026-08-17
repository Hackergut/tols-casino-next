'use client';

import { useCallback, useEffect, useRef, useState } from "react";

interface BalanceState {
  balance: number;
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
export function useBalance() {
  const [state, setState] = useState<BalanceState>({
    balance: 0,
    currency: "USDT",
    loading: true,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchBalance = useCallback(async () => {
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
      setState({
        balance: Number(data.balance ?? 0),
        currency: data.currency ?? "USDT",
        loading: false,
        error: null,
      });
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setState((prev) => ({ ...prev, loading: false, error: e.message }));
    }
  }, []);

  // Instant UI deduction before the server confirms
  const optimisticDeduct = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      balance: Math.max(0, prev.balance - amount),
    }));
  }, []);

  // Instant UI addition (e.g. winning a bet, deposit credited)
  const optimisticAdd = useCallback((amount: number) => {
    setState((prev) => ({
      ...prev,
      balance: prev.balance + amount,
    }));
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
    refresh: fetchBalance,
    optimisticDeduct,
    optimisticAdd,
  };
}
