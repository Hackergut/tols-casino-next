import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAuth } from "@/lib/platform-auth";

export async function GET(req: NextRequest) {
  const auth = requirePlatformAuth(req);
  if ("response" in auth) return auth.response;

  return NextResponse.json({
    success: true,
    data: {
      authenticated: true,
      claims: auth.claims,
      service: "tols-casino",
      note: "JWT valid — the Tower is authenticated. You can call /deposits, /withdrawals etc.",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
}
