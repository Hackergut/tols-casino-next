import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin, auditLog } from "@/lib/admin-auth";

const VALID_STATUSES = ["unverified", "pending", "verified", "rejected"];

// GET /api/admin/kyc?userId=... — fetch a user's KYC status + DOB (operator only)
export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return err("userId required", 400);

  const user = await db.casinoUser.findUnique({
    where: { id: userId },
    select: { id: true, username: true, email: true, kycStatus: true, dateOfBirth: true },
  });
  if (!user) return err("User not found", 404);
  return ok(user);
}

// PUT /api/admin/kyc — set a user's KYC status. Body: { userId, status }
// status is one of unverified | pending | verified | rejected. Real-money
// withdrawals are blocked unless kycStatus === "verified" when REQUIRE_KYC=true.
export async function PUT(req: NextRequest) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.userId) return err("userId required", 400);
  const status = String(body.status ?? "");
  if (!VALID_STATUSES.includes(status)) return err("Invalid status", 400);

  const user = await db.casinoUser
    .update({
      where: { id: String(body.userId) },
      data: { kycStatus: status },
      select: { id: true, username: true, email: true, kycStatus: true },
    })
    .catch(() => null);
  if (!user) return err("User not found", 404);

  await auditLog(guard.session, "admin.kyc", { userId: user.id, kycStatus: status });
  return ok(user);
}
