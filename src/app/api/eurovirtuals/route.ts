import { NextResponse } from "next/server";
import { evConfigured } from "@/lib/eurovirtuals";

/*
 * Health/info at the callback base URL. EuroVirtuals appends the action
 * (/player_info, /bet, …) to reach the real handlers, but a bare hit on the
 * base should return something sensible rather than a 404 — some providers ping
 * it to validate the URL during onboarding.
 */
export async function GET() {
  const { eurovirtualsCallbackUrls } = await import("@/lib/eurovirtuals-connection");
  const urls = eurovirtualsCallbackUrls();
  return NextResponse.json({
    service: "eurovirtuals-callbacks",
    status: "ok",
    configured: await evConfigured(),
    base: urls.base,
    callbacks: urls.actions.map((a) => a.url),
    note: "EuroVirtuals POSTs to these URLs. Append the action to the base.",
  });
}

// Some integrators probe the base with POST — answer instead of 404/405.
export function POST() {
  return NextResponse.json({ status_code: 200, status_description: "eurovirtuals callback base — append the action (/bet, /win, …)" });
}
