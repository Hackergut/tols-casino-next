import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { fireTelegramAlert } from "@/lib/telegram";
import { requireAdmin } from "@/lib/admin-auth";

/*
 * Operator withdrawal queue.
 *
 * A withdrawal request already debited the player's wallet (the funds are
 * "held" so they cannot be re-spent while pending). This route is the missing
 * other half: an operator either settles it — the money left the platform, the
 * hold becomes permanent — or rejects it, which must return the held funds to
 * the wallet. Both transitions are atomic and only ever apply once.
 */

type Status = "pending" | "approved" | "rejected";

// GET /api/ops/withdrawals?status=pending — the operator queue.
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(200, Number(searchParams.get("limit") ?? 100));

  const [rows, pendingAgg] = await Promise.all([
    db.casinoWithdrawal.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, username: true, email: true } } },
    }),
    db.casinoWithdrawal.aggregate({
      where: { status: "pending" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  return ok({
    pendingCount: pendingAgg._count._all,
    pendingAmount: pendingAgg._sum.amount ?? 0,
    withdrawals: rows.map((w) => ({
      id: w.id,
      userId: w.userId,
      username: w.user?.username ?? "",
      email: w.user?.email ?? "",
      amount: w.amount,
      currency: w.currency,
      chain: w.chain,
      walletAddress: w.walletAddress,
      status: w.status,
      txHash: w.txHash,
      balanceBefore: w.balanceBefore,
      balanceAfter: w.balanceAfter,
      processedDate: w.processedDate?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    })),
  });
}

// POST /api/ops/withdrawals — { id, action: "approve" | "reject", txHash?, reason? }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { id, action, txHash, reason } = body as {
    id?: string; action?: string; txHash?: string; reason?: string;
  };
  if (!id) return err("id is required", 400);
  if (action !== "approve" && action !== "reject") {
    return err('action must be "approve" or "reject"', 400);
  }

  const w = await db.casinoWithdrawal.findUnique({
    where: { id },
    include: { user: { select: { username: true } } },
  });
  if (!w) return err("Withdrawal not found", 404);

  // Only a pending request can be settled — this is what makes the endpoint
  // safe to retry: a second call cannot double-refund or re-approve.
  if (w.status !== "pending") {
    return err(`Withdrawal already ${w.status}`, 409);
  }

  if (action === "approve") {
    const updated = await db.casinoWithdrawal.update({
      where: { id },
      data: {
        status: "approved" satisfies Status,
        txHash: txHash || w.txHash,
        processedDate: new Date(),
      },
    });
    fireTelegramAlert({
      event: "withdrawal",
      title: "Withdrawal approved",
      message:
        `Player: ${w.user?.username ?? w.userId}\n` +
        `Amount: ${w.amount} ${w.currency} (${w.chain})\n` +
        `To: ${w.walletAddress}` +
        (updated.txHash ? `\nTx: ${updated.txHash}` : ""),
    });
    return ok({ id, status: updated.status, txHash: updated.txHash });
  }

  // Reject — the hold placed at request time has to go back to the wallet,
  // in the same transaction that marks the row rejected.
  const [updated, wallet] = await db.$transaction([
    db.casinoWithdrawal.update({
      where: { id },
      data: {
        status: "rejected" satisfies Status,
        processedDate: new Date(),
      },
    }),
    db.casinoWallet.update({
      where: { userId: w.userId },
      data: { balance: { increment: w.amount } },
    }),
  ]);

  fireTelegramAlert({
    event: "withdrawal",
    title: "Withdrawal rejected — funds returned",
    message:
      `Player: ${w.user?.username ?? w.userId}\n` +
      `Amount: ${w.amount} ${w.currency} returned to balance\n` +
      `New balance: ${wallet.balance}` +
      (reason ? `\nReason: ${reason}` : ""),
  });

  return ok({ id, status: updated.status, refunded: w.amount, newBalance: wallet.balance });
}
