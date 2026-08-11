import { NextRequest } from "next/server";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyDeposit } from "@/lib/payment/chain-verifier";
import { isValidChain } from "@/lib/chains";

// POST /api/admin/verify-tx — operator tool: verify any on-chain tx against an
// address + amount without crediting anything. Useful to inspect a tx before a
// manual confirm, and to sanity-check the verifier config. Body:
// { chain, txHash, address, amount, minConfirmations? }
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);
  const chain = String(body.chain ?? "");
  const txHash = String(body.txHash ?? "").trim();
  const address = String(body.address ?? "").trim();
  const amount = Number(body.amount);
  if (!isValidChain(chain)) return err("Unsupported chain", 400);
  if (!txHash || !address || !Number.isFinite(amount)) return err("chain, txHash, address, amount required", 400);

  const result = await verifyDeposit({
    chain, txHash,
    expectedAddress: address,
    expectedAmount: amount,
    minConfirmations: Number.isFinite(Number(body.minConfirmations)) ? Number(body.minConfirmations) : 1,
  });
  return ok(result);
}
