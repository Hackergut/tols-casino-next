"use client";

/*
 * One balance, one writer order.
 *
 * The balance used to exist twice: `page.tsx` held a `useState` refreshed by a
 * 15s `setInterval`, and every game's `useBet` held its own copy seeded once
 * from `initialBalance`. Two independent copies of the same number, updated by
 * two independent sources, is the whole bug:
 *
 *   1. The poll fires at t=0 and its request is in flight.
 *   2. The player bets at t=40ms; the server settles it and returns the new
 *      balance; the UI shows it.
 *   3. The poll's response — a snapshot taken BEFORE the bet — lands at t=90ms
 *      and overwrites the correct figure with the pre-bet one.
 *
 * The balance then visibly jumps backwards, and the stake guard starts
 * comparing against a number the wallet no longer holds. Nothing is lost on the
 * server (the debit is atomic and authoritative), but the client lies until the
 * next poll, and "the number moved on its own" is indistinguishable from theft
 * to the player looking at it.
 *
 * The fix is not "poll faster". It is to give every write a sequence number and
 * refuse writes derived from a read older than the newest applied write. A bet
 * response is authoritative by construction — the server computed it from the
 * row it had just locked — so it always wins; a poll only wins when nothing has
 * settled since it started.
 */

import { create } from "zustand";

interface BalanceState {
  /** The balance to display. Always the newest authoritative value. */
  balance: number;
  /** Monotonic counter, bumped on every accepted write. */
  seq: number;
  /**
   * Snapshot the current sequence before starting a read. Pass the result to
   * `applyPoll` to prove the read is not stale.
   */
  begin: () => number;
  /**
   * Apply a balance returned by a settled bet. Unconditional: the server
   * computed it inside the same transaction that moved the money.
   */
  applyServer: (balance: number) => void;
  /**
   * Apply a balance from a background read (poll, wallet fetch). Ignored if any
   * authoritative write landed after `token` was taken, because this value was
   * read from the database before that write existed.
   */
  applyPoll: (balance: number, token: number) => void;
}

/** Reject values that would poison the display (NaN from a failed parse). */
function usable(n: number): boolean {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/** Money is held to the cent; comparisons and display both depend on it. */
export function toCents(n: number): number {
  return Math.round(n * 100);
}

export const useBalanceStore = create<BalanceState>((set, get) => ({
  balance: 0,
  seq: 0,

  begin: () => get().seq,

  applyServer: (balance) => {
    if (!usable(balance)) return;
    set((s) => ({ balance: Math.round(balance * 100) / 100, seq: s.seq + 1 }));
  },

  applyPoll: (balance, token) => {
    if (!usable(balance)) return;
    // A newer authoritative write happened while this read was in flight.
    if (get().seq !== token) return;
    set((s) => ({ balance: Math.round(balance * 100) / 100, seq: s.seq + 1 }));
  },
}));
