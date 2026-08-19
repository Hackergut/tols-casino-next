"use client";

import { useCallback, useEffect, useState } from "react";
import type { BetResponse } from "@/shared/types";

export function useGameEngine(gameId: string) {
  const [round, setRound] = useState<BetResponse | null>(null);
  const [result, setResult] = useState<BetResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRound(null);
    setResult(null);
    setError(null);
  }, [gameId]);

  const emit = (data: BetResponse) => {
    window.dispatchEvent(new CustomEvent("tols:bet", { detail: data }));
    window.dispatchEvent(new CustomEvent("tols:balance", { detail: data.newBalance }));
  };

  const placeBet = useCallback(
    async (amount: number, payload: Record<string, unknown> = {}, mode?: string) => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game: gameId, amount, payload, mode }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error || "Bet failed");
          return null;
        }
        const data = json.data as BetResponse;
        if (data.pending) setRound(data);
        else setResult(data);
        emit(data);
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Bet failed");
        return null;
      } finally {
        setPending(false);
      }
    },
    [gameId],
  );

  const sendAction = useCallback(
    async (roundId: string, action: { type: string } & Record<string, unknown>) => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(`/api/games/${gameId}/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roundId, action }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error || "Action failed");
          return null;
        }
        const data = json.data as BetResponse;
        if (data.pending) setRound(data);
        else {
          setResult(data);
          setRound(null);
        }
        emit(data);
        return data;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
        return null;
      } finally {
        setPending(false);
      }
    },
    [gameId],
  );

  return { round, result, pending, error, placeBet, sendAction, setRound, setResult };
}
