import { requireAdmin } from "@/lib/admin-auth";
import { evConfigured } from "@/lib/eurovirtuals";
import { ok } from "@/lib/session";

// GET /api/admin/virtual-games/config
// Returns which EuroVirtuals env vars are present (NEVER the values) and the
// list of callback paths the provider may hit. Powers the "Config health"
// card on the admin Virtual Games page.
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  return ok({
    service: "eurovirtuals",
    status: evConfigured() ? "ok" : "not_configured",
    configured: evConfigured(),
    env: {
      EV_API_BASE: Boolean(process.env.EV_API_BASE),
      EV_API_KEY: Boolean(process.env.EV_API_KEY),
      EV_APP_KEY: Boolean(process.env.EV_APP_KEY),
    },
    callbacks: ["/player_info", "/bet", "/win", "/rollback", "/adjustment"],
  });
}
