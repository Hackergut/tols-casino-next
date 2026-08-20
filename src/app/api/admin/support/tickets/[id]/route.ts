import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-auth";
import { publish } from "@/lib/realtime";
import { serializeSupportMessage } from "@/lib/support";

// Operator ticket actions — get the conversation, reply as an agent, or close
// the ticket. The reply path is byte-for-byte what `governance.support_reply`
// triggers on the bridge webhook, so the player always receives the same
// real-time update.

// GET /api/admin/support/tickets/:id — full ticket + conversation.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!ticket) return err("Ticket not found", 404);

  return ok({
    id: ticket.id,
    userId: ticket.userId,
    subject: ticket.subject,
    status: ticket.status === "closed" ? "closed" : "open",
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    messages: ticket.messages.map(serializeSupportMessage),
  });
}

// POST /api/admin/support/tickets/:id/reply — agent reply, delivered to the
// player in real time over SSE.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({ where: { id } });
  if (!ticket) return err("Ticket not found", 404);

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "reply");

  if (action === "close") {
    const updated = await db.supportTicket.update({ where: { id }, data: { status: "closed" } });
    publish({ event: "support:ticket", userId: ticket.userId, data: { ticket: { id, status: "closed" } } });
    return ok({ id, status: updated.status });
  }

  const content = String(body?.message ?? "").trim().slice(0, 2000);
  if (!content) return err("Message is required", 400);

  const message = await db.supportMessage.create({
    data: { ticketId: id, sender: "agent", author: guard.session.username || "Support", content },
  });
  await db.supportTicket.update({ where: { id }, data: { status: "open" } });

  const wire = serializeSupportMessage(message);
  publish({ event: "support:message", userId: ticket.userId, data: { ticketId: id, message: wire } });

  return ok(wire, 201);
}
