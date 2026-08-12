import { NextRequest, NextResponse } from "next/server";
import {
  vendorConfigured, verifySignature, verifyLaunchToken,
  getBalance, applyBet, applyWin, rollback, WalletError,
} from "@/lib/vendor-wallet";

/*
 * Seamless-wallet callback for external game vendors.
 *
 * The vendor's game server calls this during play. Auth is layered:
 *   1. HMAC-SHA256 signature over the raw body (header X-Signature), shared secret
 *   2. optional IP allowlist (VENDOR_ALLOWED_IPS, comma-separated)
 *   3. a signed launch token that names the player
 *
 * Generic JSON contract (adapt the field mapping to your aggregator):
 *   POST /api/vendor/callback
 *   { action, token, amount?, currency?, txId?, roundId?, refTxId?, vendor? }
 *   → { status: "OK", balance, currency, txId? } | { status: "ERROR", code, message }
 *
 * Errors always return 200 with an ERROR body — most aggregators expect the
 * business error in the payload, not an HTTP status. Only auth failures 4xx.
 */

function clientIp(req: NextRequest): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
}
function ipAllowed(req: NextRequest): boolean {
  const list = (process.env.VENDOR_ALLOWED_IPS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true; // not configured → rely on signature only
  return list.includes(clientIp(req));
}

const ERR = (code: string, message: string) =>
  NextResponse.json({ status: "ERROR", code, message });

export async function POST(req: NextRequest) {
  if (!vendorConfigured()) {
    return NextResponse.json({ status: "ERROR", code: "NOT_CONFIGURED", message: "Vendor wallet not configured" }, { status: 503 });
  }
  if (!ipAllowed(req)) {
    return NextResponse.json({ status: "ERROR", code: "IP_BLOCKED", message: "Source IP not allowed" }, { status: 403 });
  }

  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-signature"))) {
    return NextResponse.json({ status: "ERROR", code: "BAD_SIGNATURE", message: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return ERR("BAD_REQUEST", "Malformed JSON"); }

  const action = String(body.action ?? "").toLowerCase();
  const vendor = String(body.vendor ?? "default");
  const userId = verifyLaunchToken(body.token as string | undefined);
  if (!userId) return ERR("INVALID_TOKEN", "Expired or invalid player token");

  try {
    // Balance ────────────────────────────────────────────────
    if (action === "balance") {
      const b = await getBalance(userId);
      if (!b) return ERR("USER_NOT_FOUND", "No wallet");
      return NextResponse.json({ status: "OK", balance: round(b.balance), currency: b.currency });
    }

    // Bet (debit) ────────────────────────────────────────────
    if (action === "bet" || action === "debit") {
      const amount = num(body.amount);
      const txId = String(body.txId ?? body.transactionId ?? "");
      if (amount <= 0 || !txId) return ERR("BAD_REQUEST", "amount and txId required");
      const r = await applyBet({ vendor, userId, amount, externalTxId: txId, roundId: str(body.roundId), currency: str(body.currency), raw });
      return NextResponse.json({ status: "OK", balance: round(r.balance), txId: r.txId });
    }

    // Win (credit) ───────────────────────────────────────────
    if (action === "win" || action === "credit") {
      const amount = num(body.amount);
      const txId = String(body.txId ?? body.transactionId ?? "");
      if (amount < 0 || !txId) return ERR("BAD_REQUEST", "amount and txId required");
      const r = await applyWin({ vendor, userId, amount, externalTxId: txId, roundId: str(body.roundId), currency: str(body.currency), raw });
      return NextResponse.json({ status: "OK", balance: round(r.balance), txId: r.txId });
    }

    // Rollback ───────────────────────────────────────────────
    if (action === "rollback" || action === "refund") {
      const refTxId = String(body.refTxId ?? body.betTxId ?? "");
      const txId = String(body.txId ?? body.transactionId ?? "");
      if (!refTxId || !txId) return ERR("BAD_REQUEST", "refTxId and txId required");
      const r = await rollback(vendor, refTxId, txId, raw);
      return NextResponse.json({ status: "OK", balance: round(r.balance) });
    }

    return ERR("UNKNOWN_ACTION", `Unsupported action: ${action}`);
  } catch (e) {
    if (e instanceof WalletError) return ERR(e.code, e.message);
    console.error("[vendor/callback]", e);
    return ERR("INTERNAL", "Processing error");
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;
const str = (v: unknown) => (v == null ? undefined : String(v));
const round = (n: number) => Math.round(n * 100) / 100;
