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
  /** True for a zero-value round played from an empty wallet. */
  practice?: boolean;
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
  /**
   * Serial request tail. Rapid clicks are queued rather than silently dropped
   * or sent concurrently. Concurrent settlements can arrive out of order and
   * make an older `newBalance` overwrite a newer one; a serial queue preserves
   * both fluid input and ledger order.
   */
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const reservedCents = useRef(0);

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
    (amount: number, payload?: Record<string, unknown>): Promise<BetResponse<P> | null> => {
      const currentBalance = useBalanceStore.getState().balance;
      const practice = toCents(currentBalance) <= 0;
      const stake = practice ? 0 : Math.round(amount * 100) / 100;
      const stakeCents = toCents(stake);

      if (!practice && !(stake > 0)) {
        setError("Invalid stake");
        return Promise.resolve(null);
      }
      // Reserve queued stakes immediately. Without this, ten quick clicks can
      // all validate against the same pre-bet balance and the last nine only
      // fail after travelling to the server.
      if (!practice && stakeCents + reservedCents.current > toCents(currentBalance)) {
        setError("Insufficient balance");
        return Promise.resolve(null);
      }

      reservedCents.current += stakeCents;
      pending.current += 1;
      setBusy(true);
      setError(null);

      let resolveResult!: (value: BetResponse<P> | null) => void;
      const resultPromise = new Promise<BetResponse<P> | null>((resolve) => {
        resolveResult = resolve;
      });

      const execute = async () => {
        try {
          const res = await fetch("/api/bets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ game, amount: stake, payload }),
          });
          const json = await res.json().catch(() => null);
          if (!alive.current) return resolveResult(null);
          if (!res.ok || !json?.success) {
            setError(typeof json?.error === "string" ? json.error : `Bet failed (${res.status})`);
            return resolveResult(null);
          }
          const data = json.data as BetResponse<P>;
          applyServer(data.newBalance);
          setFairness({
            serverSeedHash: data.serverSeedHash,
            clientSeed: data.clientSeed,
            nonce: data.nonce,
          });
          setHistory((prev) => [data.won ? data.multiplier : 0, ...prev].slice(0, 10));
          const charged = Number.isFinite(data.amount) ? data.amount : stake;
          setProfit((p) => Math.round((p + (data.payout - charged)) * 100) / 100);
          setBetCount((c) => c + 1);
          resolveResult(data);
        } catch {
          // A POST must never be retried blindly: the server may have committed
          // the debit even when its response was lost. Reconcile the wallet
          // instead, then let the player decide whether to submit another bet.
          let reconciled = false;
          try {
            const walletRes = await fetch("/api/wallet", { cache: "no-store" });
            const walletJson = await walletRes.json();
            if (walletRes.ok && Number.isFinite(walletJson?.data?.balance)) {
              applyServer(walletJson.data.balance);
              reconciled = true;
            }
          } catch {
            // Preserve the original connection error when reconciliation also
            // fails; the next lobby poll will make another ordered attempt.
          }
          if (alive.current) {
            setError(
              reconciled
                ? "Connection interrupted. Wallet refreshed safely; you can retry."
                : "Connection interrupted. Check your balance before retrying.",
            );
          }
          resolveResult(null);
        } finally {
          reservedCents.current = Math.max(0, reservedCents.current - stakeCents);
          pending.current = Math.max(0, pending.current - 1);
          if (alive.current && pending.current === 0) setBusy(false);
        }
      };

      // Keep the tail alive even when a previous network operation failed.
      queue.current = queue.current.then(execute, execute);
      return resultPromise;
    },
    [game, applyServer],
  );

  return { balance, setBalance: applyServer, busy, error, history, fairness, profit, betCount, place };
}
