import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/*
 * Generic seamless-wallet core for external game vendors / aggregators.
 *
 * The vendor runs the game; TOLS keeps the balance. During play the vendor's
 * server calls POST /api/vendor/callback for balance / bet / win / rollback.
 * This module holds the vendor-agnostic pieces so a specific aggregator only
 * needs a thin adapter (field names + how it signs requests):
 *
 *   - HMAC-SHA256 request signing over the raw body (shared secret)
 *   - a stateless, signed launch token that identifies the player in callbacks
 *   - idempotent, atomic debit / credit / rollback backed by the VendorTxn ledger
 *
 * Money-movement rules that must never be broken:
 *   - Every mutation is keyed by the vendor's transaction id. A replay returns
 *     the stored result — it never debits or credits twice.
 *   - A bet can never take a balance negative (guarded, atomic decrement).
 *   - A failed idempotency insert rolls back the wallet change in the same tx.
 */

const SECRET = process.env.VENDOR_CALLBACK_SECRET || "";
const LAUNCH_SECRET = process.env.VENDOR_LAUNCH_SECRET || SECRET;
const LAUNCH_TTL_SEC = 60 * 60 * 6; // launch token valid for 6h of play

export function vendorConfigured(): boolean {
  return SECRET.length >= 16;
}

// ── Request signature (HMAC-SHA256 over the exact raw body) ──
export function signBody(rawBody: string): string {
  return createHmac("sha256", SECRET).update(rawBody).digest("hex");
}
export function verifySignature(rawBody: string, provided: string | null): boolean {
  if (!provided || !SECRET) return false;
  const expected = signBody(rawBody);
  const a = Buffer.from(expected);
  const b = Buffer.from(provided.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Launch token: base64url(userId.exp).hmac — stateless, no DB lookup ──
function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}
export function issueLaunchToken(userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + LAUNCH_TTL_SEC;
  const payload = b64url(`${userId}.${exp}`);
  const sig = createHmac("sha256", LAUNCH_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyLaunchToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", LAUNCH_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId, expStr] = Buffer.from(payload, "base64url").toString().split(".");
  if (!userId || Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  return userId;
}

// ── Balance ──
export async function getBalance(userId: string): Promise<{ balance: number; currency: string } | null> {
  const w = await db.casinoWallet.findUnique({ where: { userId }, select: { balance: true, currency: true } });
  return w ? { balance: w.balance, currency: w.currency } : null;
}

export class WalletError extends Error {
  constructor(public code: "INSUFFICIENT_FUNDS" | "USER_NOT_FOUND" | "TX_NOT_FOUND", message: string) {
    super(message);
  }
}

interface TxInput {
  vendor: string;
  userId: string;
  amount: number;
  externalTxId: string;
  roundId?: string;
  currency?: string;
  raw?: string;
}

// ── Debit (bet) — idempotent + atomic ──
export async function applyBet(input: TxInput): Promise<{ balance: number; txId: string; replay: boolean }> {
  const existing = await db.vendorTxn.findUnique({ where: { vendor_externalTxId: { vendor: input.vendor, externalTxId: input.externalTxId } } });
  if (existing) return { balance: existing.balanceAfter, txId: existing.id, replay: true };

  try {
    return await db.$transaction(async (tx) => {
      // Atomic decrement that cannot cross zero: 0 rows updated == not enough.
      const dec = await tx.casinoWallet.updateMany({
        where: { userId: input.userId, balance: { gte: input.amount } },
        data: { balance: { decrement: input.amount }, totalWagered: { increment: input.amount } },
      });
      if (dec.count === 0) {
        const w = await tx.casinoWallet.findUnique({ where: { userId: input.userId }, select: { id: true } });
        throw new WalletError(w ? "INSUFFICIENT_FUNDS" : "USER_NOT_FOUND", "cannot debit");
      }
      const w = await tx.casinoWallet.findUnique({ where: { userId: input.userId }, select: { balance: true, currency: true } });
      const row = await tx.vendorTxn.create({
        data: {
          vendor: input.vendor, externalTxId: input.externalTxId, roundId: input.roundId,
          userId: input.userId, type: "bet", amount: input.amount,
          currency: input.currency ?? w!.currency, balanceAfter: w!.balance, rawPayload: input.raw,
        },
      });
      return { balance: w!.balance, txId: row.id, replay: false };
    });
  } catch (e) {
    // Concurrent duplicate: the unique insert lost the race and rolled the
    // debit back. Return the winner's stored result — no double debit.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const r = await db.vendorTxn.findUnique({ where: { vendor_externalTxId: { vendor: input.vendor, externalTxId: input.externalTxId } } });
      if (r) return { balance: r.balanceAfter, txId: r.id, replay: true };
    }
    throw e;
  }
}

// ── Credit (win) — idempotent + atomic ──
export async function applyWin(input: TxInput): Promise<{ balance: number; txId: string; replay: boolean }> {
  const existing = await db.vendorTxn.findUnique({ where: { vendor_externalTxId: { vendor: input.vendor, externalTxId: input.externalTxId } } });
  if (existing) return { balance: existing.balanceAfter, txId: existing.id, replay: true };

  try {
    return await db.$transaction(async (tx) => {
      const upd = await tx.casinoWallet.updateMany({
        where: { userId: input.userId },
        data: { balance: { increment: input.amount }, totalWon: { increment: input.amount } },
      });
      if (upd.count === 0) throw new WalletError("USER_NOT_FOUND", "no wallet");
      const w = await tx.casinoWallet.findUnique({ where: { userId: input.userId }, select: { balance: true, currency: true } });
      const row = await tx.vendorTxn.create({
        data: {
          vendor: input.vendor, externalTxId: input.externalTxId, roundId: input.roundId,
          userId: input.userId, type: "win", amount: input.amount,
          currency: input.currency ?? w!.currency, balanceAfter: w!.balance, rawPayload: input.raw,
        },
      });
      return { balance: w!.balance, txId: row.id, replay: false };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const r = await db.vendorTxn.findUnique({ where: { vendor_externalTxId: { vendor: input.vendor, externalTxId: input.externalTxId } } });
      if (r) return { balance: r.balanceAfter, txId: r.id, replay: true };
    }
    throw e;
  }
}

// ── Rollback — reverse a prior bet/win by its vendor tx id ──
export async function rollback(vendor: string, refTxId: string, rollbackTxId: string, raw?: string): Promise<{ balance: number; replay: boolean }> {
  const already = await db.vendorTxn.findUnique({ where: { vendor_externalTxId: { vendor, externalTxId: rollbackTxId } } });
  if (already) return { balance: already.balanceAfter, replay: true };

  const orig = await db.vendorTxn.findUnique({ where: { vendor_externalTxId: { vendor, externalTxId: refTxId } } });
  if (!orig) throw new WalletError("TX_NOT_FOUND", "nothing to roll back");

  // Reversing a bet gives money back (+); reversing a win takes it away (−).
  const delta = orig.type === "bet" ? orig.amount : -orig.amount;
  return await db.$transaction(async (tx) => {
    await tx.casinoWallet.update({ where: { userId: orig.userId }, data: { balance: { increment: delta } } });
    if (orig.status !== "rolled_back") {
      await tx.vendorTxn.update({ where: { id: orig.id }, data: { status: "rolled_back" } });
    }
    const w = await tx.casinoWallet.findUnique({ where: { userId: orig.userId }, select: { balance: true, currency: true } });
    await tx.vendorTxn.create({
      data: {
        vendor, externalTxId: rollbackTxId, roundId: orig.roundId, userId: orig.userId,
        type: "rollback", amount: Math.abs(delta), currency: w!.currency, balanceAfter: w!.balance, rawPayload: raw,
      },
    });
    return { balance: w!.balance, replay: false };
  });
}
