"use client";

/*
 * Auto-betting, once.
 *
 * Every bet panel shipped a "Manual / Auto" tab from the first Goated-style
 * frame, but no game ever implemented the Auto half: the tab persisted the
 * choice and did nothing. A control that promises automation and silently
 * stays manual is worse than no control at all — this hook is the missing
 * half, shared by all twelve Originals so the behaviour cannot drift.
 *
 * The design constraints, stated once:
 *
 *  - SERIAL. Each round fully settles (request + animation + result) before
 *    the next starts, so the ledger order matches what the player watched.
 *  - STOP ON ANY FAILURE. `runOnce` resolves null whenever a round did not
 *    settle (rejected bet, insufficient balance, dropped connection); the
 *    loop stops instead of hammering a failing endpoint.
 *  - STOP ON LIMITS. Round cap, profit target and loss limit come from the
 *    persisted auto config; 0 means "no limit".
 *  - STOP WHEN INVISIBLE. Switching game or leaving the page unmounts the
 *    hook, which halts the loop — an orphan loop would keep betting on a
 *    game nobody is watching.
 *  - FAST. While auto is running, games skip result animations (isAutoRunning
 *    folds into the same flag as Quick Play), otherwise a round of Crash at
 *    a high target would take minutes.
 */

import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";
import { useGameSettings } from "@/lib/game-settings";

export interface AutoStatus {
  /** Game currently auto-playing; one game at a time can run. */
  gameId: string | null;
  running: boolean;
  /** Settled rounds in the current run. */
  round: number;
  /** Net profit of the current run, in wallet currency. */
  net: number;
}

/**
 * Read-only status, separate from the settings store because it is live
 * session state — persisting "running" to localStorage would restart a dead
 * loop's UI on the next visit.
 */
export const useAutoStatus = create<AutoStatus>(() => ({
  gameId: null,
  running: false,
  round: 0,
  net: 0,
}));

/** Imperative check used inside play functions, where hooks cannot run. */
export function isAutoRunning(gameId: string): boolean {
  const s = useAutoStatus.getState();
  return s.running && s.gameId === gameId;
}

/** Breathing room between rounds so the result of one is readable. */
const ROUND_DELAY_MS = 450;

/**
 * Drive one game's play function in a loop.
 *
 * `runOnce` must settle exactly one round and resolve to its net profit
 * (payout − charged stake, rounded to cents), or null when the round did not
 * settle. Returning null stops the loop — by design: a rejected bet is a
 * signal (balance gone, rate limited, logged out), not a retry.
 */
export function useAutoBet(gameId: string, runOnce: () => Promise<number | null>) {
  const running = useAutoStatus((s) => s.running && s.gameId === gameId);
  const stopRef = useRef(false);
  const runRef = useRef(runOnce);
  useEffect(() => {
    runRef.current = runOnce;
  });

  // Unmounting (game switch, back to lobby, logout) stops the loop.
  useEffect(() => {
    return () => {
      stopRef.current = true;
      const s = useAutoStatus.getState();
      if (s.gameId === gameId && s.running) useAutoStatus.setState({ running: false });
    };
  }, [gameId]);

  const start = useCallback(async () => {
    if (useAutoStatus.getState().running) return;
    stopRef.current = false;
    useAutoStatus.setState({ gameId, running: true, round: 0, net: 0 });

    let count = 0;
    let net = 0;
    try {
      for (;;) {
        // Read the limits fresh each round: the player may tighten a stop
        // limit mid-run, and that must take effect immediately.
        const cfg = useGameSettings.getState().auto;
        if (cfg.rounds > 0 && count >= cfg.rounds) break;
        if (stopRef.current) break;

        const p = await runRef.current();
        if (p === null || stopRef.current) break;

        count += 1;
        net = Math.round((net + p) * 100) / 100;
        useAutoStatus.setState({ round: count, net });

        if (cfg.stopOnProfit > 0 && net >= cfg.stopOnProfit) break;
        if (cfg.stopOnLoss > 0 && -net >= cfg.stopOnLoss) break;

        await new Promise((r) => setTimeout(r, ROUND_DELAY_MS));
      }
    } finally {
      useAutoStatus.setState({ running: false });
    }
  }, [gameId]);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  return { running, start, stop };
}
