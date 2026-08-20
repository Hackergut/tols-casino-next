"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AutoBetParams, AutoBetStatus, BetResponse } from "@/shared/types";
import { DEFAULT_AUTO_BET } from "@/shared/constants";

export function useAutoBet(gameId: string) {
  const [status, setStatus] = useState<AutoBetStatus | null>(null);
  const [lastBet, setLastBet] = useState<BetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const running = status?.status === "running";
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/auto-bet/status`);
    const json = await res.json();
    if (json.success) setStatus(json.data);
  }, [gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const tick = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/auto-bet/tick`, { method: "POST" });
    const json = await res.json();
    if (!json.success) {
      setError(json.error || "Tick failed");
      await refresh();
      return;
    }
    if (!mounted.current) return;
    setStatus(json.data.status);
    if (json.data.bet) {
      setLastBet(json.data.bet);
      window.dispatchEvent(new CustomEvent("tols:bet", { detail: json.data.bet }));
      window.dispatchEvent(new CustomEvent("tols:balance", { detail: json.data.bet.availableBalance ?? json.data.bet.newBalance }));
      window.dispatchEvent(
        new CustomEvent("tols:bonus", {
          detail: { bonusBalance: json.data.bet.bonusBalance ?? 0, wageringRemaining: json.data.bet.wageringRemaining ?? 0 },
        }),
      );
    }
    if (json.data.status.status === "running") {
      timer.current = setTimeout(() => void tick(), 420);
    }
  }, [gameId, refresh]);

  const start = useCallback(
    async (params: Partial<AutoBetParams> & { baseBet: number }) => {
      setError(null);
      const res = await fetch(`/api/games/${gameId}/auto-bet/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...DEFAULT_AUTO_BET, ...params }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Failed to start");
        return;
      }
      setStatus(json.data);
      timer.current = setTimeout(() => void tick(), 80);
    },
    [gameId, tick],
  );

  const stop = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const res = await fetch(`/api/games/${gameId}/auto-bet/stop`, { method: "POST" });
    const json = await res.json();
    if (json.success) setStatus(json.data);
    else await refresh();
  }, [gameId, refresh]);

  return { status, lastBet, error, running, start, stop, refresh };
}
