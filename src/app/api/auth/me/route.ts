import { getCurrentUser } from "@/lib/auth";
import { ok } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return ok(null);
  return ok({
    id: user.id,
    username: user.username,
    email: user.email,
    avatarColor: user.avatarColor,
    level: user.level,
    balance: user.wallet?.balance ?? 0,
    currency: user.wallet?.currency ?? "USDT",
    vipLevel: user.wallet?.vipLevel ?? 1,
    totalWagered: user.wallet?.totalWagered ?? 0,
  });
}
