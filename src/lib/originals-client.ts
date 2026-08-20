"use client";

import { useEffect, useState } from "react";
import type { BetResponse } from "@/shared/types";

export function emitOriginalsParams(gameId: string, params: Record<string, unknown>, bet: number) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tols:game-params", { detail: { gameId, params, bet } }));
}

export function emitOriginalsResult(data: BetResponse) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tols:bet", { detail: data }));
  if (typeof data.newBalance === "number") {
    window.dispatchEvent(new CustomEvent("tols:balance", { detail: data.newBalance }));
  }
}

export async function placeOriginalsBet(
  game: string,
  amount: number,
  payload: Record<string, unknown> = {},
  mode?: string,
): Promise<BetResponse> {
  const res = await fetch("/api/bets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game, amount, payload, mode }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Bet failed");
  const data = json.data as BetResponse;
  emitOriginalsResult(data);
  return data;
}

export async function originalsAction(
  game: string,
  roundId: string,
  action: { type: string } & Record<string, unknown>,
): Promise<BetResponse> {
  const res = await fetch(`/api/games/${game}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roundId, action }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Action failed");
  const data = json.data as BetResponse;
  emitOriginalsResult(data);
  return data;
}

/** Keeps in-game balance in sync with Auto Bet / other Originals, and publishes live params. */
export function useOriginalsSession(gameId: string, params: Record<string, unknown>, bet: number, initialBalance: number) {
  const [balance, setBalance] = useState(initialBalance);
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    emitOriginalsParams(gameId, JSON.parse(paramsKey) as Record<string, unknown>, bet);
  }, [gameId, bet, paramsKey]);

  useEffect(() => {
    const onBal = (e: Event) => {
      const n = Number((e as CustomEvent).detail);
      if (Number.isFinite(n)) setBalance(n);
    };
    window.addEventListener("tols:balance", onBal);
    return () => window.removeEventListener("tols:balance", onBal);
  }, []);

  return { balance, setBalance };
}
