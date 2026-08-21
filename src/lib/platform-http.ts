import { NextResponse } from "next/server";

export const PLATFORM_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Bridge-Signature, X-Bridge-Timestamp",
};

export function platformOptions() {
  return new NextResponse(null, { status: 204, headers: PLATFORM_CORS });
}

export function pageParams(url: URL) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const q = url.searchParams.get("q")?.trim() || "";
  return { limit, offset, q };
}

export const PLATFORM_CATALOG = [
  { method: "GET", path: "/api/platform/health", auth: "none", use: "Casino + DB heartbeat" },
  { method: "GET", path: "/api/platform/whoami", auth: "jwt", use: "Verify the Governance JWT" },
  { method: "GET", path: "/api/platform/overview", auth: "jwt", use: "Dashboard: users, cash, bets, pending KYC" },
  { method: "GET", path: "/api/platform/users", auth: "jwt", use: "Players / registrations" },
  { method: "GET", path: "/api/platform/users/:id", auth: "jwt", use: "One player + wallet" },
  { method: "PATCH", path: "/api/platform/users/:id", auth: "jwt", use: "Block / unblock a player" },
  { method: "GET", path: "/api/platform/wallets", auth: "jwt", use: "Balances, VIP, wagered" },
  { method: "POST", path: "/api/platform/wallets/adjust", auth: "jwt", use: "Credit or debit a wallet" },
  { method: "GET", path: "/api/platform/deposits", auth: "jwt", use: "Deposit ledger" },
  { method: "GET", path: "/api/platform/withdrawals", auth: "jwt", use: "Withdrawal queue" },
  { method: "POST", path: "/api/platform/withdrawals/:id/approve", auth: "jwt", use: "Approve a withdrawal" },
  { method: "POST", path: "/api/platform/withdrawals/:id/reject", auth: "jwt", use: "Reject a withdrawal" },
  { method: "GET", path: "/api/platform/payments", auth: "jwt", use: "Cash-flow aggregates" },
  { method: "GET", path: "/api/platform/cashflow", auth: "jwt", use: "Deposits, withdrawals, house P&L" },
  { method: "GET", path: "/api/platform/bets", auth: "jwt", use: "Settled wagers" },
  { method: "GET", path: "/api/platform/rtp", auth: "jwt", use: "Per-game RTP vs target" },
  { method: "PUT", path: "/api/platform/rtp", auth: "jwt", use: "Set house-edge bias for a game" },
  { method: "GET", path: "/api/platform/promotions", auth: "jwt", use: "Promo / game card CMS" },
  { method: "PUT", path: "/api/platform/promotions", auth: "jwt", use: "Upsert a promo or game card" },
  { method: "GET", path: "/api/platform/stats", auth: "jwt", use: "Headline counts" },
] as const;
