import { NextRequest, NextResponse } from "next/server";
import { evConfigured, verifyEvSignature, evUserFromToken, evDate } from "@/lib/eurovirtuals";
import { getBalance, applyBet, applyWin, rollback, WalletError } from "@/lib/vendor-wallet";
import { randomUUID } from "crypto";

/*
 * EuroVirtuals seamless-wallet callbacks (provider → operator).
 * One route serves /player_info, /bet, /win, /rollback, /adjustment.
 *
 * Contract quirks handled here:
 *   - every response is HTTP 200; the real result is `status_code` in the body
 *   - requests are authenticated by the custom MD5 signature (x-signature-key)
 *   - the player is identified by the launch token we issued (player_token)
 *   - money moves through the shared idempotent/atomic wallet core, keyed by
 *     the EuroVirtuals transaction_id, so retries never double-spend
 */

const VENDOR = "eurovirtuals";

function body(status_code: number, status_description: string, data?: unknown) {
  // Always HTTP 200 — EuroVirtuals treats any other status as "not delivered".
  return NextResponse.json(data ? { status_code, status_description, data } : { status_code, status_description });
}
function okData(balance: number, currency: string) {
  return { balance: Math.round(balance * 100) / 100, currency, reference_id: randomUUID(), date: evDate() };
}
const num = (v: unknown) => (typeof v === "number" ? v : Number(v)) || 0;

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  if (!evConfigured()) return body(500, "EuroVirtuals not configured");
  const endpoint = (await ctx.params).action;

  const raw = await req.text();
  let p: Record<string, unknown>;
  try { p = JSON.parse(raw); } catch { return body(400, "Bad Request"); }

  if (!verifyEvSignature(p, req.headers.get("x-signature-key"), req.headers.get("x-timestamp"))) {
    return body(401, "Unauthorised access");
  }

  const userId = evUserFromToken(p.player_token as string) ?? String(p.player_id ?? "");
  if (!userId) return body(401, "Invalid player token");
  const currency = String(p.currency ?? "USD");
  const txId = String(p.transaction_id ?? "");

  try {
    switch (endpoint) {
      case "player_info": {
        const b = await getBalance(userId);
        if (!b) return body(500, "No wallet");
        return body(200, "Success", okData(b.balance, b.currency));
      }

      case "bet": {
        if (!txId) return body(422, "Missing transaction_id");
        const r = await applyBet({ vendor: VENDOR, userId, amount: num(p.amount), externalTxId: txId, roundId: p.round_id ? String(p.round_id) : undefined, currency, raw });
        return body(200, "Success", okData(r.balance, currency));
      }

      case "win": {
        if (!txId) return body(422, "Missing transaction_id");
        // result_lost carries payout_amount 0 — still recorded to settle the round.
        const r = await applyWin({ vendor: VENDOR, userId, amount: num(p.payout_amount), externalTxId: txId, roundId: p.round_id ? String(p.round_id) : undefined, currency, raw });
        return body(200, "Success", okData(r.balance, currency));
      }

      case "rollback": {
        if (!txId) return body(422, "Missing transaction_id");
        const action = String(p.action ?? "");
        const refTxId = action === "rollback_win" ? String(p.win_transaction_id ?? "") : String(p.bet_id ?? "");
        if (!refTxId) return body(422, "Missing reference to roll back");
        const r = await rollback(VENDOR, refTxId, txId, raw);
        return body(200, "Success", okData(r.balance, currency));
      }

      case "adjustment": {
        if (!txId) return body(422, "Missing transaction_id");
        const amount = num(p.amount);
        const credit = String(p.action ?? "") === "wallet_adjustment_credit" || amount > 0;
        const r = credit
          ? await applyWin({ vendor: VENDOR, userId, amount: Math.abs(amount), externalTxId: txId, currency, raw })
          : await applyBet({ vendor: VENDOR, userId, amount: Math.abs(amount), externalTxId: txId, currency, raw });
        return body(200, "Success", okData(r.balance, currency));
      }

      default:
        return body(400, `Unknown callback: ${endpoint}`);
    }
  } catch (e) {
    if (e instanceof WalletError) {
      if (e.code === "INSUFFICIENT_FUNDS") return body(402, "Insufficient Balance");
      return body(500, e.message);
    }
    console.error("[eurovirtuals]", endpoint, e);
    return body(500, "Internal Server Error");
  }
}
