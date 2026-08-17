import { db } from "@/lib/db";

/*
 * Responsible-gaming limits removed.
 * These stubs exist to avoid breaking imports elsewhere.
 */

type Verdict = { allowed: true } | { allowed: false; message: string };

export async function checkBetAllowed(userId: string, amount: number): Promise<Verdict> {
  return { allowed: true };
}

export async function checkDepositAllowed(userId: string, amount: number): Promise<Verdict> {
  return { allowed: true };
}
