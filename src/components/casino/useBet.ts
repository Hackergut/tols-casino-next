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
import { useBalanceStore, toCents } from "@/lib/balance-store";

export interface BetResponse<P = Record<string, unknown>> {
  won: boolean;
  multiplier: number;
  payout: number;
  newBalance: number;
  /** The stake actually charged, snapped to whole cents by the server. */
  amount: number;
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
  /*
   * The balance is read from the shared store, not held locally. A local copy
   * seeded once from `initialBalance` drifted from the wallet the moment the
   * lobby poll updated one and not the other — and the stake guard below
   * compares against it, so the drift decided whether a bet was allowed.
   */
  const balance = useBalanceStore((s) => s.balance);
  const applyServer = useBalanceStore((s) => s.applyServer);

  // Seed the store on first mount so a game opened directly (deep link) shows a
  // balance before the first poll returns. Never overwrites a settled value.
  useEffect(() => {
    const st = useBalanceStore.getState();
    if (st.seq === 0 && Number.isFinite(initialBalance)) st.applyServer(initialBalance);
  }, [initialBalance]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [fairness, setFairness] = useState<Fairness | null>(null);
  /** Session profit/loss and settled-bet count, for the shared frame header
   *  and to refresh the bet feed. Presentation only — the balance the server
   *  returns stays authoritative. */
  const [profit, setProfit] = useState(0);
  const [betCount, setBetCount] = useState(0);
  const alive = useRef(true);
  /** Guards against a second POST before `busy` has re-rendered. */
  const inFlight = useRef(false);

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
      /*
       * Double-submit guard.
       *
       * `busy` was read from the closure and listed as a dependency, so the
       * callback identity changed on every toggle — but a handler captured by
       * an in-flight animation frame still held the previous closure, where
       * `busy` was false. Two clicks inside one frame therefore produced two
       * POSTs, and every POST to /api/bets debits. A ref is checked and set in
       * the same synchronous tick, so the second call cannot observe the stale
       * value.
       */
      if (inFlight.current) return null;

      const stake = Math.round(amount * 100) / 100;
      // Compare in cents: a balance of 0.9999999999999999 after fractional
      // credits must still allow a 1.00 all-in.
      if (!(stake > 0)) {
        setError("Invalid stake");
        return null;
      }
      if (toCents(stake) > toCents(balance)) {
        setError("Insufficient balance");
        return null;
      }

      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/bets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ game, amount: stake, payload }),
        });
        const json = await res.json();
        if (!alive.current) return null;
        if (!json?.success) {
          setError(typeof json?.error === "string" ? json.error : "Bet failed");
          return null;
        }
        const data = json.data as BetResponse<P>;
        // Authoritative: computed by the server inside the transaction that
        // moved the money. Beats any poll still in flight.
        applyServer(data.newBalance);
        setFairness({
          serverSeedHash: data.serverSeedHash,
          clientSeed: data.clientSeed,
          nonce: data.nonce,
        });
        setHistory((prev) => [data.won ? data.multiplier : 0, ...prev].slice(0, 10));
        // Use the stake the server echoes back, not the requested amount, so
        // session P/L can never disagree with the wallet.
        const charged = Number.isFinite(data.amount) ? data.amount : stake;
        setProfit((p) => Math.round((p + (data.payout - charged)) * 100) / 100);
        setBetCount((c) => c + 1);
        return data;
      } catch {
        if (alive.current) setError("Network error");
        return null;
      } finally {
        // Always clears, including on the error paths that used to leave the
        // action button spinning forever. The ref clears even after unmount:
        // it guards the request, not the render.
        inFlight.current = false;
        if (alive.current) setBusy(false);
      }
    },
    [balance, game, applyServer],
  );

  return { balance, setBalance: applyServer, busy, error, history, fairness, profit, betCount, place };
}
