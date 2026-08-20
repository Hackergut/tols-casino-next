import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { CHAINS, CHAIN_IDS, isValidChain } from "@/lib/chains";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/deposit-addresses — list configured addresses (admin only)
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const rows = (await db.depositAddress.findMany()) as Array<{
    chain: string;
    address: string;
    memo: string;
    minConfirmations: number;
    enabled: boolean;
  }>;
  const byChain = new Map(rows.map((r) => [r.chain, r]));

  // Return every supported chain, filling in blanks for unconfigured ones.
  return ok(
    CHAIN_IDS.map((id) => {
      const r = byChain.get(id);
      return {
        chain: id,
        name: CHAINS[id].name,
        symbol: CHAINS[id].symbol,
        address: r?.address ?? "",
        memo: r?.memo ?? "",
        minConfirmations: r?.minConfirmations ?? 2,
        enabled: r?.enabled ?? false,
      };
    }),
  );
}

// PUT /api/admin/deposit-addresses — upsert an address for a chain (admin only)
// Body: { chain, address, memo?, minConfirmations?, enabled? }
// SECURITY: this only accepts a PUBLIC receive address. Never accept or store a
// seed phrase or private key here.
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid request", 400);

  const chain = String(body.chain ?? "");
  if (!isValidChain(chain)) return err("Unsupported chain", 400);

  const address = String(body.address ?? "").trim();
  // Guard against someone pasting a seed phrase into the address field.
  if (address.split(/\s+/).length >= 12) {
    return err("That looks like a seed phrase — only paste a PUBLIC receive address here", 400);
  }

  const memo = String(body.memo ?? "").trim();
  const minConfirmations = Number.isFinite(Number(body.minConfirmations))
    ? Math.max(0, Math.min(64, Number(body.minConfirmations)))
    : 2;
  const enabled = Boolean(body.enabled ?? true) && address.length > 0;

  const row = await db.depositAddress.upsert({
    where: { chain },
    update: { address, memo, minConfirmations, enabled, label: CHAINS[chain].name },
    create: { chain, address, memo, minConfirmations, enabled, label: CHAINS[chain].name },
  });

  return ok({ chain: row.chain, address: row.address, enabled: row.enabled, minConfirmations: row.minConfirmations });
}
