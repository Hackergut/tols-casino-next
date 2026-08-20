import { NextRequest, NextResponse } from "next/server";
import { verifyPlatformJwt, getBearerToken, type PlatformJwtClaims } from "./platform-jwt";

export interface PlatformAuthSuccess {
  claims: PlatformJwtClaims;
}
export interface PlatformAuthFailure {
  response: NextResponse;
}

/**
 * Guard per tutte le /api/platform/* — richiede JWT RS256 valido
 * Header: Authorization: Bearer <jwt firmato dalla Tower con RS256>
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
            : "Invia Authorization: Bearer <jwt RS256> firmato con PLATFORM_JWT_PRIVATE_KEY della Tower. Verifica iss/aud/exp.",
        },
        { status: isMissingKey ? 503 : 401 }
      ),
    };
  }

  // opzionale: controlla scope
  // per health/whoami basta qualsiasi JWT valido; per write serve withdrawals:write
  return { claims: result.claims };
}

export function hasScope(claims: PlatformJwtClaims, scope: string): boolean {
  if (!claims.scope || claims.scope.length === 0) return true; // se non specificato, permetti (retrocompat)
  if (claims.scope.includes(scope) || claims.scope.includes("*") || claims.scope.includes("platform:*")) return true;
  // Alias per compatibilità governance UI: withdrawals:approve ↔ withdrawals:write
  const aliases: Record<string, string[]> = {
    "withdrawals:write": ["withdrawals:approve", "withdrawals:write"],
    "withdrawals:approve": ["withdrawals:write", "withdrawals:approve"],
    "withdrawals:read": ["withdrawals:read", "withdrawals:write", "withdrawals:approve"],
    "deposits:read": ["deposits:read", "deposits:write"],
    "payments:read": ["payments:read", "payments:write"],
    "events:write": ["events:write", "events:*"],
  };
  const alts = aliases[scope];
  if (alts) return alts.some((s) => claims.scope!.includes(s));
  return false;
}
