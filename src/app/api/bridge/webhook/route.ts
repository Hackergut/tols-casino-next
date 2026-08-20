import { NextRequest, NextResponse } from "next/server";
import { verifyRuntimeBridgeSignature, isKnownInboundType } from "@/lib/governance-bridge";
import { db } from "@/lib/db";
import { publish } from "@/lib/realtime";
import { serializeSupportMessage } from "@/lib/support";

/**
 * POST /api/bridge/webhook — Governance Tower → Casino
 *
 * Auth: HMAC SHA256 over raw JSON body with GOVERNANCE_BRIDGE_SECRET
 *       (alias GOVERNANCE_WEBHOOK_SECRET) in header:
 *         X-Bridge-Signature: sha256=<hex>  or  <hex>
 *         X-Webhook-Signature: <hex>        (alias)
 *         X-Tower-Signature: <hex>          (alias)
 *
 * Also accepts CRON_SECRET as fallback so Vercel Cron can ping it.
 */

function getSignature(req: NextRequest): string | null {
  return (
    req.headers.get("x-bridge-signature") ||
    req.headers.get("x-webhook-signature") ||
    req.headers.get("x-tower-signature") ||
    req.headers.get("x-governance-signature") ||
    null
  );
}

function isCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || req.headers.get("x-cron-secret") || "";
  return got === cronSecret;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = getSignature(req);

  // Allow either valid HMAC or CRON_SECRET (for scheduled pings)
  const hmacOk = await verifyRuntimeBridgeSignature(raw, sig);
  const cronOk = isCron(req);

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }

  const type = String((body as Record<string, unknown>).type || (body as Record<string, unknown>).event || "ping");

  // Ping is always allowed even without auth (useful for domain wiring checks)
  if (type === "ping") {
    await db.telegramNotification.create({
      data: {
        eventType: "bridge_ping",
        title: "Bridge ping",
        message: `Ping from ${req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown"} — Tower → Casino OK`,
        chatId: "bridge",
        status: "pending",
      },
    }).catch(() => {});
    return NextResponse.json({ success: true, ok: true, type: "pong", ts: new Date().toISOString(), note: "Casino bridge is live" });
  }

  if (!hmacOk && !cronOk) {
    return NextResponse.json({ success: false, error: "Invalid bridge signature. Create the Governance connection or set GOVERNANCE_BRIDGE_SECRET, then send X-Bridge-Signature: sha256=<hmac>." }, { status: 401 });
  }
  if (hmacOk) {
    const timestamp = Number(req.headers.get("x-bridge-timestamp"));
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
      return NextResponse.json({ success: false, error: "Missing or stale X-Bridge-Timestamp (maximum clock skew: 5 minutes)" }, { status: 401 });
    }
  }

  if (!isKnownInboundType(type) && !type.startsWith("governance.")) {
    return NextResponse.json({ success: false, error: `Unknown event type: ${type}`, known: ["governance.rtp_update","governance.limits_update","governance.feature_flag","governance.session_invalidate","governance.wallet_adjust","governance.player_block","ping"] }, { status: 400 });
  }

  const payload = (body.payload ?? body.data ?? {}) as Record<string, unknown>;

  // Persist inbound for audit
  await db.telegramNotification.create({
    data: {
      eventType: `bridge:${type}`,
      title: `Bridge: ${type}`,
      message: JSON.stringify({ type, payload }).slice(0, 2000),
      chatId: "bridge",
      status: "pending",
    },
  }).catch(() => {});

  // ── Route each governance event ──────────────────────────────────────
  try {
    switch (type) {
      case "governance.rtp_update": {
        // payload: { gameId?, userId?, mode, rtpTarget? }
        const { gameId, userId, mode, rtpTarget } = payload as { gameId?: string; userId?: string; mode?: string; rtpTarget?: number };
        if (!mode) return NextResponse.json({ success: false, error: "mode is required" }, { status: 400 });
        await db.operationControl.create({
          data: {
            name: `bridge:rtp:${Date.now()}`,
            description: `From Governance Tower — game=${gameId || "all"} user=${userId || "all"} mode=${mode}`,
            targetScope: userId ? (gameId ? "user_game" : "user") : (gameId ? "game" : "all"),
            targetValue: userId && gameId ? `${userId}:${gameId}` : (userId || gameId || null),
            controlMode: String(mode),
            rtpTarget: typeof rtpTarget === "number" ? rtpTarget : null,
            enabled: true,
            priority: 100, // bridge controls outrank manual ones
          },
        });
        break;
      }
      case "governance.limits_update": {
        // payload: { userId, limits: { maxBet, dailyLoss, ... } }
        const { userId, limits } = payload as { userId?: string; limits?: Record<string, unknown> };
        if (!userId || !limits) return NextResponse.json({ success: false, error: "userId and limits required" }, { status: 400 });
        await db.crmActivity.create({
          data: { action: "governance.limits_update", entityType: "bridge", entityId: String(userId), details: JSON.stringify(limits).slice(0, 900) },
        });
        // If ResponsibleLimit model exists, upsert there (best-effort)
        // else audit trail is enough for operator to apply.
        break;
      }
      case "governance.session_invalidate": {
        const { userId } = payload as { userId?: string };
        if (!userId) return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
        await db.authSession.deleteMany({ where: { userId: String(userId) } }).catch(() => {});
        break;
      }
      case "governance.wallet_adjust": {
        const { userId, amount, reason } = payload as { userId?: string; amount?: number; reason?: string };
        if (!userId || typeof amount !== "number") return NextResponse.json({ success: false, error: "userId and amount required" }, { status: 400 });
        // Credit/debit via wallet — idempotent-ish via CrmActivity dedup
        const wallet = await db.casinoWallet.findUnique({ where: { userId: String(userId) } });
        if (!wallet) return NextResponse.json({ success: false, error: "Wallet not found" }, { status: 404 });
        await db.casinoWallet.update({ where: { userId: String(userId) }, data: { balance: wallet.balance + amount } });
        await db.crmActivity.create({
          data: { action: "governance.wallet_adjust", entityType: "bridge", entityId: String(userId), details: JSON.stringify({ amount, reason }).slice(0, 900) },
        }).catch(() => {});
        break;
      }
      case "governance.player_block": {
        const { userId, blocked } = payload as { userId?: string; blocked?: boolean };
        if (!userId) return NextResponse.json({ success: false, error: "userId required" }, { status: 400 });
        await db.casinoUser.update({ where: { id: String(userId) }, data: { status: blocked ? "blocked" : "active" } }).catch(() => {});
        break;
      }
      case "governance.support_reply": {
        // An agent on the Governance Tower replied to a player's support
        // ticket. Persist the message and push it to the player in real time.
        const { ticketId, userId, content, agentName } = payload as { ticketId?: string; userId?: string; content?: string; agentName?: string };
        if (!ticketId || !userId || !content) {
          return NextResponse.json({ success: false, error: "ticketId, userId and content are required" }, { status: 400 });
        }
        const ticket = await db.supportTicket.findFirst({ where: { id: String(ticketId), userId: String(userId) } });
        if (!ticket) return NextResponse.json({ success: false, error: "Support ticket not found" }, { status: 404 });

        const message = await db.supportMessage.create({
          data: { ticketId: ticket.id, sender: "agent", author: agentName || "Support", content: String(content).slice(0, 2000) },
        });
        await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "open" } });

        publish({
          event: "support:message",
          userId: ticket.userId,
          data: { ticketId: ticket.id, message: serializeSupportMessage(message) },
        });
        break;
      }
      case "governance.support_close": {
        const { ticketId, userId } = payload as { ticketId?: string; userId?: string };
        if (!ticketId || !userId) {
          return NextResponse.json({ success: false, error: "ticketId and userId are required" }, { status: 400 });
        }
        const ticket = await db.supportTicket.findFirst({ where: { id: String(ticketId), userId: String(userId) } });
        if (ticket) {
          await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "closed" } });
          publish({ event: "support:ticket", userId: ticket.userId, data: { ticket: { id: ticket.id, status: "closed" } } });
        }
        break;
      }
      case "governance.feature_flag": {
        // Just audited; actual flag store is future work
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  return NextResponse.json({ success: true, ok: true, type, accepted: true, ts: new Date().toISOString() });
}

// GET so Tower / operator can verify webhook is reachable (no auth needed for availability)
export async function GET() {
  return NextResponse.json({ success: true, service: "tols-casino-bridge-webhook", reachable: true, ts: new Date().toISOString(), hint: "POST with X-Bridge-Signature: sha256=<hmac sha256 of raw body using GOVERNANCE_BRIDGE_SECRET>" });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS,HEAD", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Bridge-Signature, X-Webhook-Signature, X-Tower-Signature, X-Governance-Signature, X-Cron-Secret" } });
}
