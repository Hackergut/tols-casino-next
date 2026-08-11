import { db } from "@/lib/db";
import { ok } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";

// GET /api/admin/users — lightweight user list for admin dropdowns (operator only)
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const users = await db.casinoUser.findMany({
    select: { id: true, username: true, email: true, role: true, status: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return ok(users);
}
