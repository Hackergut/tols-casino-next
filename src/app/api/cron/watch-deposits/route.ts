import { NextRequest } from "next/server";
import { watchDeposits } from "@/lib/payment/deposit-watcher";
import { ok, err } from "@/lib/session";

// GET/POST /api/cron/watch-deposits — run the on-chain deposit watcher.
// Protected by CRON_SECRET so only your external scheduler or Vercel Cron can
// trigger it. Call e.g.:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://app/api/cron/watch-deposits
async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = new URL(req.url).searchParams.get("secret") || "";
  return (bearer === secret || q === secret);
}

export async function POST(req: NextRequest) {
  if (!(await authorize(req))) return err("Unauthorized", 401);
  const result = await watchDeposits(50);
  return ok(result);
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return err("Unauthorized", 401);
  const result = await watchDeposits(50);
  return ok(result);
}
