"use client";

/*
 * The bet lifecycle, once.
 *
 * Every Original had its own copy of: guard the stake, POST /api/bets, read
 * data.data, update the balance, push history, capture the fairness commitment,
 * clear the busy flag. Twelve copies meant twelve chances to drift — and they
 * had: some forgot the fairness payload, some pushed a differently-shaped
 * history entry, some left `busy` set when the request threw.
 *
 * The outcome is still decided entirely on the server. This only owns the
 * request and the state around it.
 */

import { useCallback, useRef, useState, useEffect } from "react";

export interface BetResponse<P = Record<string, unknown>> {
  won: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  payload: P;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface Fairness {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export function useBet<P = Record<string, unknown>>(game: string, initialBalance: number) {
  const [balance, setBalance] = useState(initialBalance);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [fairness, setFairness] = useState<Fairness | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Place a bet. Resolves with the server's result, or null if it was rejected
   * or the request failed — callers branch on null rather than on a throw,
   * because a failed bet is an expected outcome (insufficient balance, rate
   * limit), not an exception.
   */
  const place = useCallback(
    async (amount: number, payload?: Record<string, unknown>): Promise<BetResponse<P> | null> => {
      if (busy) return null;
      if (!(amount > 0) || amount > balance) {
        setError("Invalid stake");
        return null;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, amount, payload }),
        });
        const json = await res.json();
        if (!alive.current) return null;
        if (!json?.success) {
          setError(typeof json?.error === "string" ? json.error : "Bet failed");
          return null;
        }
        const data = json.data as BetResponse<P>;
        setBalance(data.newBalance);
        setFairness({
          serverSeedHash: data.serverSeedHash,
          clientSeed: data.clientSeed,
          nonce: data.nonce,
        });
        setHistory((prev) => [data.won ? data.multiplier : 0, ...prev].slice(0, 10));
        return data;
      } catch {
        if (alive.current) setError("Network error");
        return null;
      } finally {
        // Always clears, including on the error paths that used to leave the
        // action button spinning forever.
        if (alive.current) setBusy(false);
      }
    },
    [busy, balance, game],
  );

  return { balance, setBalance, busy, error, history, fairness, place };
}
