import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, err } from "@/lib/session";

// GET /api/deposits/status/[id] — poll a single deposit's current status.
// Used by the frontend to update the DepositPanel in real time after the user
// submits payment. Returns lean JSON so it's cheap to poll every few seconds.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return err("Unauthorized", 401);

  const deposit = await db.casinoDeposit.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      status: true,
      credited: true,
      amount: true,
      amountUsd: true,
      chain: true,
      currency: true,
      txHash: true,
      createdAt: true,
    },
  });

  if (!deposit) return err("Deposit not found", 404);

  return ok({
    id: deposit.id,
    status: deposit.status,
    credited: deposit.credited,
    amount: deposit.amount,
    amountUsd: deposit.amountUsd,
    chain: deposit.chain,
    currency: deposit.currency,
    txHash: deposit.txHash?.startsWith("pending_") ? null : deposit.txHash,
    createdAt: deposit.createdAt.toISOString(),
  });
}
