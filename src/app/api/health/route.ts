import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";

// GET /api/health — lightweight liveness/readiness probe.
// Public (no auth) so a load balancer or uptime monitor can poll it. Pings the
// database with SELECT 1; returns 503 if the DB is unreachable so the instance
// is pulled from rotation before it serves real traffic.
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return ok({ status: "ok", db: "up", latencyMs: Date.now() - started }, 200);
  } catch (e) {
    return err("database unreachable", 503);
  }
}
