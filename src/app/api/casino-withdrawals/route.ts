import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";
import { fireTelegramAlert } from "@/lib/telegram";
import { rateLimit, LIMITS } from "@/lib/rate-limit";

// POST /api/withdrawals — request withdrawal.
// Withdrawals are NOT auto-paid: they're recorded as pending, the balance is
// held (decremented) so it can't be double-spent, and an operator approves and
// sends the on-chain payment manually. This is standard for custodial casinos.
export async function POST(req: NextRequest) {
  const limited = await rateLimit("withdraw", LIMITS.money);
  if (limited) return limited;

  const user = await getSession();
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { amount, walletAddress, chain = "solana" } = body as { amount: number; walletAddress: string; chain?: string };
  if (!["solana", "ethereum", "polygon", "btc", "eth", "usdt_erc20"].includes(chain)) return err("Invalid chain", 400);
  if (typeof amount !== "number" || amount < 20) return err("Minimum withdrawal is 20 USDT", 400);
  if (typeof walletAddress !== "string" || walletAddress.length < 10) return err("Invalid wallet address", 400);

  // KYC gate: real-money withdrawals require a verified identity when enabled.
  if (process.env.REQUIRE_KYC === "true" && user.kycStatus !== "verified") {
    return err("Identity verification (KYC) is required before withdrawing. Please contact support.", 403);
  }

  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return err("No wallet", 400);
  if (wallet.balance < amount) return err("Insufficient balance", 400);

  const txHash = chain.slice(0, 3) + "_wd_" + Math.random().toString(36).slice(2, 14);

  // Hold the funds and record the request in one transaction. The conditional
  // updateMany (balance >= amount) is the authoritative guard: two concurrent
  // withdrawals cannot both pass a stale read and overdraw — the second hold
  // updates zero rows if the balance no longer covers it.
  const result = await db.$transaction(async (tx) => {
    const held = await tx.casinoWallet.updateMany({
      where: { userId: user.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (held.count === 0) return { insufficient: true } as const;

    const w = await tx.casinoWallet.findUnique({
      where: { userId: user.id },
      select: { balance: true },
    });
    const balanceAfter = w?.balance ?? 0;
    const withdrawal = await tx.casinoWithdrawal.create({
      data: {
        userId: user.id,
        amount,
        currency: "USDT",
        walletAddress,
        chain,
        status: "pending",
        txHash,
        balanceBefore: balanceAfter + amount,
        balanceAfter,
      },
    });
    return { insufficient: false, withdrawal } as const;
  });

  if ("insufficient" in result && result.insufficient) return err("Insufficient balance", 400);
  const withdrawal = result.withdrawal;

  fireTelegramAlert({
    event: "withdrawal",
    title: "🏧 Withdrawal requested",
    message:
      `User: ${user.username}\n` +
      `Amount: ${amount} USDT\n` +
      `Chain: ${chain}\n` +
      `To: ${walletAddress}\n` +
      `Needs manual approval · id: ${withdrawal.id}`,
  });

  return ok({
    id: withdrawal.id,
    amount: withdrawal.amount,
    currency: withdrawal.currency,
    walletAddress: withdrawal.walletAddress,
    chain: withdrawal.chain,
    status: withdrawal.status,
    txHash: withdrawal.txHash,
    createdAt: withdrawal.createdAt.toISOString(),
  });
}

// GET /api/withdrawals — list withdrawals
export async function GET() {
  const user = await getSession();
  const withdrawals = await db.casinoWithdrawal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return ok(withdrawals.map((w) => ({
    id: w.id, amount: w.amount, currency: w.currency, walletAddress: w.walletAddress,
    chain: w.chain, status: w.status, txHash: w.txHash,
    createdAt: w.createdAt.toISOString(), processedDate: w.processedDate?.toISOString(),
  })));
}
