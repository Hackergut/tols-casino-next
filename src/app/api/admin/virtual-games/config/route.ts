import { requireAdmin } from "@/lib/admin-auth";
import { evConfigured, evEnvConfigured } from "@/lib/eurovirtuals";
import { eurovirtualsCallbackUrls, getEurovirtualsConnection, publicEurovirtualsConnection } from "@/lib/eurovirtuals-connection";
import { ok } from "@/lib/session";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const stored = await getEurovirtualsConnection().catch(() => null);
  const urls = eurovirtualsCallbackUrls();

  return ok({
    service: "eurovirtuals",
    status: (await evConfigured()) ? "ok" : "not_configured",
    configured: await evConfigured(),
    env: {
      EV_API_BASE: Boolean(process.env.EV_API_BASE),
      EV_API_KEY: Boolean(process.env.EV_API_KEY),
      EV_APP_KEY: Boolean(process.env.EV_APP_KEY),
    },
    environmentLive: evEnvConfigured(),
    connection: publicEurovirtualsConnection(stored),
    callbacks: urls.actions.map((a) => a.url),
    callbackBase: urls.base,
    vendorGeneric: urls.vendorGeneric,
  });
}
