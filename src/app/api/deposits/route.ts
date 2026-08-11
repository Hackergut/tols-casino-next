import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, getCurrentUser, Unauthorized } from "@/lib/auth";
import { ok, err } from "@/lib/session";
import { isValidChain, CHAINS } from "@/lib/chains";
import { fireTelegramAlert } from "@/lib/telegram";

// GET /api/deposits — current user's deposit history
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ok([]);
  const deposits = await db.casinoDeposit.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return ok(
    deposits.map((d) => ({
      id: d.id,
      chain: d.chain,
      amount: d.amount,
      currency: d.currency,
      status: d.status,
      credited: d.credited,
      txHash: d.txHash,
      createdAt: d.createdAt.toISOString(),
    }))
  );
}

// POST /api/deposits — register a pending on-chain deposit intent.
// The player tells us they've sent (or are about to send) an amount to the
// static address. It stays PENDING until confirmed on-chain (via the admin
// confirm route or a chain watcher). We never auto-credit unconfirmed funds.
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Unauthorized) return err("Sign in to deposit", 401);
    throw e;
  }

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid request", 400);

  const chain = String(body.chain ?? "");
  const amount = Number(body.amount);
  const currency = String(body.currency ?? "USDT");
  const txHash = String(body.txHash ?? "").trim();

  if (!isValidChain(chain)) return err("Unsupported chain", 400);
  if (!Number.isFinite(amount) || amount <= 0) return err("Enter a valid amount", 400);

  const record = await db.depositAddress.findUnique({ where: { chain } });
  if (!record || !record.enabled) return err("Deposits for this chain are not available yet", 503);

  const deposit = await db.casinoDeposit.create({
    data: {
      userId: user.id,
      chain,
      txHash: txHash || `pending_${Date.now().toString(36)}`,
      amount,
      currency,
      status: "pending",
      credited: false,
      toAddress: record.address,
    },
  });

  fireTelegramAlert({
    event: "deposit_pending",
    title: "⏳ Deposit pending",
    message:
      `User: ${user.username}\n` +
      `Chain: ${CHAINS[chain].name}\n` +
      `Amount: ${amount} ${currency}\n` +
      `To: ${record.address}\n` +
      (txHash ? `Tx: ${txHash}\n` : "") +
      `Deposit id: ${deposit.id}`,
  });

  return ok({
    id: deposit.id,
    status: deposit.status,
    message: "Deposit registered. Funds are credited after on-chain confirmation.",
  });
}
