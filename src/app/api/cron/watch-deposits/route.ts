import { NextRequest } from "next/server";
import { watchDeposits } from "@/lib/payment/deposit-watcher";
import { ok, err } from "@/lib/session";

async function authorize(req: NextRequest): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = new URL(req.url).searchParams.get("secret") || "";
  return (bearer === secret || q === secret);
}

async function runWatcher(req: NextRequest) {
  if (!(await authorize(req))) return err("Unauthorized", 401);

  const { searchParams } = new URL(req.url);
  const batch = Math.min(200, Math.max(1, Number(searchParams.get("batch") ?? 50)));
  const startMs = Date.now();

  try {
    const result = await watchDeposits(batch);
    const durationMs = Date.now() - startMs;
    return ok({
      ...result,
      batch,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    const durationMs = Date.now() - startMs;
    console.error("[watch-deposits] Error:", e.message);
    return err(`Watcher error: ${e.message}`, 500);
  }
}

export async function POST(req: NextRequest) {
  return runWatcher(req);
}

export async function GET(req: NextRequest) {
  return runWatcher(req);
}
