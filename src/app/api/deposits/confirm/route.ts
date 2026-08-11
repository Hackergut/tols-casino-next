import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-auth";
import { ok, err } from "@/lib/session";
import { fireTelegramAlert } from "@/lib/telegram";
import { CHAINS } from "@/lib/chains";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { checkDepositAllowed } from "@/lib/responsible-limits";

// POST /api/deposits/confirm — confirm a pending deposit and credit the wallet.
// Admin-only. In a full setup this is called by an on-chain watcher once the
// configured number of confirmations is reached; here an operator confirms a
// verified payment. Crediting is idempotent (guarded by `credited`).
export async function POST(req: NextRequest) {
  const limited = await rateLimit("deposit-confirm", LIMITS.money);
  if (limited) return limited;

  // Operator-only: the signed admin session (tols_admin cookie), consistent
  // with /api/admin/* and /api/ops/*. Previously this money-crediting endpoint
  // only checked the player-session role, a weaker and inconsistent gate.
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.depositId) return err("depositId required", 400);
  const txHash = String(body.txHash ?? "").trim();

  const deposit = await db.casinoDeposit.findUnique({ where: { id: String(body.depositId) } });
  if (!deposit) return err("Deposit not found", 404);

  // Responsible-gaming limits: block confirmation for self-excluded players or over the deposit cap.
  const dep = await checkDepositAllowed(deposit.userId, deposit.amount);
  if (!dep.allowed) return err(dep.message, 403);

  // Atomically claim the deposit (only if not yet credited) and credit the
  // wallet in one transaction. The conditional updateMany on credited=false makes
  // confirmation idempotent under concurrency: a second concurrent confirm
  // updates zero rows and is rejected instead of crediting twice.
  const result = await db.$transaction(async (tx) => {
    const claimed = await tx.casinoDeposit.updateMany({
      where: { id: deposit.id, credited: false },
      data: { status: "confirmed", credited: true, txHash: txHash || deposit.txHash },
    });
    if (claimed.count === 0) return { alreadyCredited: true } as const;

    const wallet = await tx.casinoWallet.update({
      where: { userId: deposit.userId },
      data: { balance: { increment: deposit.amount } },
    });
    return { alreadyCredited: false, wallet } as const;
  });

  if ("alreadyCredited" in result && result.alreadyCredited) return err("Deposit already credited", 409);
  const wallet = result.wallet;

  const player = await db.casinoUser.findUnique({ where: { id: deposit.userId } });

  fireTelegramAlert({
    event: "deposit",
    title: "✅ Deposit confirmed",
    message:
      `User: ${player?.username ?? deposit.userId}\n` +
      `Chain: ${CHAINS[deposit.chain]?.name ?? deposit.chain}\n` +
      `Amount: ${deposit.amount} ${deposit.currency}\n` +
      `New balance: ${wallet.balance} ${wallet.currency}\n` +
      (txHash ? `Tx: ${txHash}` : ""),
  });

  return ok({ id: deposit.id, credited: true, newBalance: wallet.balance });
}
