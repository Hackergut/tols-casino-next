import { NextResponse } from "next/server";
import { WEB_WELCOME_BONUS } from "@/lib/welcome-bonus";

// Public: the sign-up prompt reads the bonus amount from here instead of a
// hardcoded number, so it can never advertise more than registration actually
// grants.
export function GET() {
  return NextResponse.json({ success: true, data: { amount: WEB_WELCOME_BONUS, currency: "USDT" } });
}
