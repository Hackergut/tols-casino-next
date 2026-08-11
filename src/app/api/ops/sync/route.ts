import { ok } from "@/lib/session";
import { syncAllPlayerProfiles } from "@/lib/player-sync";
import { requireAdmin } from "@/lib/admin-auth";

// POST /api/ops/sync — rebuild every operator player profile from the source
// tables. Idempotent, so it is safe to run on demand or on a schedule; use it
// to backfill history that predates the live per-bet refresh.
export async function POST() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const count = await syncAllPlayerProfiles();
  return ok({ reconciled: count });
}
