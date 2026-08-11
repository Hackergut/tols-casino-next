import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// POST /api/deposits — simulate a crypto deposit (demo: instantly credit)
export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const { chain, amount, currency = "USDT" } = body as { chain: string; amount: number; currency?: string };
  if (!["solana", "ethereum", "polygon"].includes(chain)) return err("Invalid chain", 400);
  if (typeof amount !== "number" || amount <= 0) return err("Invalid amount", 400);

  const wallet = await db.casinoWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return err("No wallet", 400);

  const txHash = chain.slice(0, 3) + "_" + Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);

  const deposit = await db.casinoDeposit.create({
    data: {
      userId: user.id,
      chain,
      txHash,
      amount,
      currency,
      status: "confirmed",
      credited: true,
      fromAddress: "0x" + Math.random().toString(16).slice(2, 12),
      toAddress: JSON.parse(wallet.depositAddresses || "{}")[chain] || "tols-deposit-" + chain,
    },
  });

  await db.casinoWallet.update({ where: { userId: user.id }, data: { balance: { increment: amount } } });

  return ok({
    id: deposit.id,
    chain: deposit.chain,
    txHash: deposit.txHash,
    amount: deposit.amount,
    currency: deposit.currency,
    status: deposit.status,
    createdAt: deposit.createdAt.toISOString(),
    credited: true,
  });
}

// GET /api/deposits — list deposits
export async function GET() {
  const user = await getSession();
  const deposits = await db.casinoDeposit.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
  return ok(deposits.map((d) => ({
    id: d.id, chain: d.chain, txHash: d.txHash, amount: d.amount, currency: d.currency,
    status: d.status, createdAt: d.createdAt.toISOString(),
  })));
}
