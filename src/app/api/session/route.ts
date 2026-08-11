import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";

// GET /api/session — the current session for the casino shell.
// Returns the authenticated user when signed in; otherwise the shared demo user
// (so preview/guest browsing still works). Includes `isAuthenticated` so the UI
// can show Sign in / Logout appropriately.
export async function GET() {
  const authed = await getCurrentUser();
  const user = authed ?? (await getSession());
  return Response.json({
    success: true,
    data: {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarColor: user.avatarColor,
      level: user.level,
      xp: user.xp,
      isAuthenticated: Boolean(authed),
      wallet: user.wallet
        ? { balance: user.wallet.balance, currency: user.wallet.currency, vipLevel: user.wallet.vipLevel }
        : null,
      affiliate: null,
    },
  });
}
