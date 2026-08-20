import { getSession, ok, err } from "@/lib/session";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const user = await getSession();
    const wallet = user.wallet ?? (await db.casinoWallet.findUnique({ where: { userId: user.id } }));
    if (!wallet) return err("Wallet not found", 404);
    return ok({
      balance: wallet.balance,
      bonusBalance: wallet.bonusBalance,
      wageringRemaining: wallet.wageringRemaining,
      availableBalance: wallet.balance + wallet.bonusBalance,
      currency: wallet.currency,
      vipLevel: wallet.vipLevel,
      xp: wallet.xp,
      totalWagered: wallet.totalWagered,
      totalWon: wallet.totalWon,
      depositAddresses: wallet.depositAddresses,
    });
  } catch {
    return err("Not authenticated", 401);
  }
}
