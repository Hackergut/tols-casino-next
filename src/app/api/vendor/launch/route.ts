import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ok, err } from "@/lib/session";
import { vendorConfigured, issueLaunchToken } from "@/lib/vendor-wallet";
import { appUrl } from "@/lib/mailer";

/*
 * Start an external-vendor game session for the signed-in player.
 *
 * Flow: the client posts { gameId, vendor? }. The server mints a signed launch
 * token that names the player, then (in a vendor adapter) would call the
 * vendor's own launch API — passing this token plus the callback URL — and get
 * back the iframe game URL. Here we return the token and the callback URL so
 * the adapter for a specific aggregator is a small addition.
 */
export async function POST(req: NextRequest) {
  if (!vendorConfigured()) return err("Vendor games are not configured", 503);

  const user = await getCurrentUser();
  if (!user) return err("Sign in to play", 401);

  const body = await req.json().catch(() => null);
  const gameId = String(body?.gameId ?? "");
  const vendor = String(body?.vendor ?? "default");
  if (!gameId) return err("gameId required", 400);

  const token = issueLaunchToken(user.id);
  const callbackUrl = `${appUrl()}/api/vendor/callback`;

  // A specific aggregator adapter goes here: call its launch endpoint with
  // { token, gameId, callbackUrl, currency } and return the game URL it gives.
  // Until one is wired, hand the client the token + callback so integration can
  // be tested end-to-end.
  return ok({
    token,
    vendor,
    gameId,
    callbackUrl,
    // launchUrl: filled by the vendor adapter (the iframe src).
    launchUrl: null,
  });
}
