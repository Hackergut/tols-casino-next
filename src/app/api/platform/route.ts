import { NextResponse } from "next/server";
import { PLATFORM_CATALOG, platformOptions } from "@/lib/platform-http";

/** GET /api/platform — catalog Governance uses to discover Casino control APIs. */
export async function GET() {
  return NextResponse.json({
    success: true,
    service: "tols-casino",
    casino: process.env.APP_URL || "https://www.tols.fun",
    governance: process.env.GOVERNANCE_TOWER_URL || "https://gov.tols.fun",
    auth: {
      jwt: "Authorization: Bearer <RS256 JWT iss=tols-governance aud=tols-casino>",
      webhook: "POST /api/bridge/webhook with X-Bridge-Signature + X-Bridge-Timestamp",
    },
    endpoints: PLATFORM_CATALOG,
  });
}

export async function OPTIONS() {
  return platformOptions();
}
