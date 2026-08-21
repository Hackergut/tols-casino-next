import { NextRequest, NextResponse } from "next/server";
import { verifyPlatformJwt, getBearerToken, type PlatformJwtClaims } from "./platform-jwt";

export interface PlatformAuthSuccess {
  claims: PlatformJwtClaims;
}
export interface PlatformAuthFailure {
  response: NextResponse;
}

/**
 * Guard for all /api/platform/* routes — requires a valid RS256 JWT.
 * Header: Authorization: Bearer <jwt signed by the Tower with RS256>
 */
export function requirePlatformAuth(req: Request | NextRequest): PlatformAuthSuccess | PlatformAuthFailure {
  const token = getBearerToken(req);
  const result = verifyPlatformJwt(token);
  if (!result.valid || !result.claims) {
    const isMissingKey = result.error?.includes("PLATFORM_JWT_PUBLIC_KEY");
    return {
      response: NextResponse.json(
        {
          success: false,
          error: result.error || "Unauthorized",
          hint: isMissingKey
            ? "Set PLATFORM_JWT_PUBLIC_KEY in the Casino Vercel project — see .env.bridge-keys"
            : "Send Authorization: Bearer <jwt RS256> signed with the Tower's PLATFORM_JWT_PRIVATE_KEY. Verify iss/aud/exp.",
        },
        { status: isMissingKey ? 503 : 401 }
      ),
    };
  }

  // Optional: check scope.
  // For health/whoami any valid JWT is enough; writes require withdrawals:write.
  return { claims: result.claims };
}

export function hasScope(claims: PlatformJwtClaims, scope: string): boolean {
  if (!claims.scope || claims.scope.length === 0) return true; // if unspecified, allow (backward compat)
  if (claims.scope.includes(scope) || claims.scope.includes("*") || claims.scope.includes("platform:*")) return true;
  // Aliases for governance UI compatibility: withdrawals:approve ↔ withdrawals:write
  const aliases: Record<string, string[]> = {
    "withdrawals:write": ["withdrawals:approve", "withdrawals:write"],
    "withdrawals:approve": ["withdrawals:write", "withdrawals:approve"],
    "withdrawals:read": ["withdrawals:read", "withdrawals:write", "withdrawals:approve"],
    "deposits:read": ["deposits:read", "deposits:write"],
    "payments:read": ["payments:read", "payments:write"],
    "events:write": ["events:write", "events:*"],
    "users:read": ["users:read", "users:write", "players:read"],
    "users:write": ["users:write", "players:write"],
    "wallets:read": ["wallets:read", "wallets:write"],
    "wallets:write": ["wallets:write"],
    "rtp:read": ["rtp:read", "rtp:write"],
    "rtp:write": ["rtp:write"],
    "cms:write": ["cms:write", "promos:write"],
    "bets:read": ["bets:read"],
  };
  const alts = aliases[scope];
  if (alts) return alts.some((s) => claims.scope!.includes(s));
  return false;
}
