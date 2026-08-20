import { MAX_BET, MIN_BET, RISK_LEVELS } from "@/shared/constants";
import type { BetValidation, SettledOutcome } from "@/shared/types";

export function okAmount(amount: number, balance: number): BetValidation {
  if (!Number.isFinite(amount) || amount < MIN_BET) return { valid: false, error: "Invalid bet amount" };
  if (amount > MAX_BET) return { valid: false, error: "Bet exceeds maximum" };
  if (amount > balance) return { valid: false, error: "Insufficient balance" };
  return { valid: true };
}

export function paid(amount: number, multiplier: number, payload: Record<string, unknown>): SettledOutcome {
  const payout = amount * multiplier;
  return { multiplier, payout, profit: payout - amount, won: multiplier > 0, payload };
}

export function isRisk(value: unknown): value is (typeof RISK_LEVELS)[number] {
  return typeof value === "string" && (RISK_LEVELS as readonly string[]).includes(value);
}

export type RouletteChip = { type: string; value?: number; amount: number };

const ROULETTE_TYPES = new Set([
  "straight", "red", "black", "odd", "even", "low", "high",
  "dozen1", "dozen2", "dozen3", "col1", "col2", "col3",
]);

/** UI sends `{ bets }`; Auto Bet may send `{ color: "red" }` — both become chips. */
export function normalizeRouletteBets(params: Record<string, unknown>, amount: number): RouletteChip[] {
  if (Array.isArray(params.bets) && params.bets.length) {
    return (params.bets as RouletteChip[])
      .map((b) => ({
        type: String(b.type),
        value: typeof b.value === "number" ? b.value : undefined,
        amount: Number(b.amount) || 0,
      }))
      .filter((b) => b.amount > 0 && ROULETTE_TYPES.has(b.type));
  }
  const raw = String(params.color ?? params.type ?? "red");
  const type = ROULETTE_TYPES.has(raw) && raw !== "straight" ? raw : "red";
  return [{ type, amount }];
}

export function betResultTag(result: {
  won: boolean;
  multiplier: number;
  payout: number;
  payload?: Record<string, unknown>;
  publicState?: Record<string, unknown>;
}): "win" | "lose" | "push" {
  const tag = String(result.payload?.result ?? result.publicState?.result ?? "");
  if (tag === "push") return "push";
  if (result.multiplier === 1 && result.payout > 0) return "push";
  return result.won ? "win" : "lose";
}
