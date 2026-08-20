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
