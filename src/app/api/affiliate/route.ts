import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, err } from "@/lib/session";

// GET /api/affiliate — affiliate dashboard stats + referrals + recent commissions
export async function GET() {
  const user = await getSession();
  let affiliate = await db.affiliate.findUnique({
    where: { userId: user.id },
    include: {
      referrals: { orderBy: { createdAt: "desc" }, take: 50 },
      commissionLogs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  // Auto-create affiliate if missing
  if (!affiliate) {
    affiliate = await db.affiliate.create({
      data: {
        userId: user.id,
        referralCode: "TOLS" + user.id.slice(2, 6).toUpperCase(),
        commissionPlan: "revshare",
        commissionRate: 25,
      },
      include: {
        referrals: true,
        commissionLogs: true,
      },
    });
  }

  return ok({
    referralCode: affiliate.referralCode,
    commissionPlan: affiliate.commissionPlan,
    commissionRate: affiliate.commissionRate,
    cpaAmount: affiliate.cpaAmount,
    totalClicks: affiliate.totalClicks,
    totalReferrals: affiliate.totalReferrals,
    totalWagered: affiliate.totalWagered,
    totalCommission: affiliate.totalCommission,
    pendingCommission: affiliate.pendingCommission,
    paidCommission: affiliate.paidCommission,
    referrals: affiliate.referrals.map((r) => ({
      id: r.id,
      playerAlias: r.playerAlias,
      status: r.status,
      totalWagered: r.totalWagered,
      commissionEarned: r.commissionEarned,
      signupDate: r.signupDate.toISOString(),
    })),
    commissionLogs: affiliate.commissionLogs.map((c) => ({
      id: c.id,
      depositAmount: c.depositAmount,
      commission: c.commission,
      plan: c.plan,
      rate: c.rate,
      currency: c.currency,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

// POST /api/affiliate — update commission plan / rate
export async function POST(req: NextRequest) {
  const user = await getSession();
  const body = await req.json().catch(() => ({}));
  let affiliate = await db.affiliate.findUnique({ where: { userId: user.id } });
  if (!affiliate) {
    affiliate = await db.affiliate.create({
      data: { userId: user.id, referralCode: "TOLS" + user.id.slice(2, 6).toUpperCase() },
    });
  }
  const data: Record<string, unknown> = {};
  if (["revshare", "cpa", "hybrid"].includes(body.commissionPlan)) data.commissionPlan = body.commissionPlan;
  if (typeof body.commissionRate === "number" && body.commissionRate >= 0 && body.commissionRate <= 50)
    data.commissionRate = body.commissionRate;
  const updated = await db.affiliate.update({ where: { id: affiliate.id }, data });
  return ok({
    referralCode: updated.referralCode,
    commissionPlan: updated.commissionPlan,
    commissionRate: updated.commissionRate,
  });
}
