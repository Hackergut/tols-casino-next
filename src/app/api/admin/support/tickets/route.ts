import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";
import { serializeSupportMessage } from "@/lib/support";

// Operator-facing support inbox. This is the same data the Governance Tower
// reads/writes over the bridge; an agent can also triage here directly. The
// reply endpoint mirrors what `governance.support_reply` does on the webhook,
// so the player loop is identical regardless of which operator surface replies.

// GET /api/admin/support/tickets — all tickets across players, newest first.
export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;

  const tickets = await db.supportTicket.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return ok(
    tickets.map((t) => ({
      id: t.id,
      userId: t.userId,
      subject: t.subject,
      status: t.status === "closed" ? "closed" : "open",
      messageCount: t.messages.length,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      lastMessage: t.messages[0] ? serializeSupportMessage(t.messages[0]) : null,
    })),
  );
}

// POST /api/admin/support/tickets/:id/reply is handled by the [id] route below;
// this file only exposes the inbox list for the operator.
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
