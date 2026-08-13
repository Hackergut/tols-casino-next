import { NextResponse } from "next/server";
import { evConfigured } from "@/lib/eurovirtuals";

/*
 * Health/info at the callback base URL. EuroVirtuals appends the action
 * (/player_info, /bet, …) to reach the real handlers, but a bare hit on the
 * base should return something sensible rather than a 404 — some providers ping
 * it to validate the URL during onboarding.
 */
export function GET() {
  return NextResponse.json({
    service: "eurovirtuals-callbacks",
    status: "ok",
    configured: evConfigured(),
    callbacks: ["/player_info", "/bet", "/win", "/rollback", "/adjustment"],
    note: "Append the action to this base URL; callbacks are POST.",
  });
}

// Some integrators probe the base with POST — answer instead of 404/405.
export function POST() {
  return NextResponse.json({ status_code: 200, status_description: "eurovirtuals callback base — append the action (/bet, /win, …)" });
}
