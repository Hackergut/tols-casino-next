import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/virtual-games/recent
// Last 50 EuroVirtuals seamless-wallet transactions (bets/wins/rollbacks).
// Powers the "Recent transactions" table on the admin Virtual Games page.
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  try {
    const rows = await db.vendorTxn.findMany({
      where: { vendor: "eurovirtuals" },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return ok(rows);
  } catch (e) {
    return err(e instanceof Error ? e.message : "Internal Server Error", 500);
  }
}
