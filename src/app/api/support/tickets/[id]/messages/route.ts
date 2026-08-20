import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { publish } from "@/lib/realtime";
import { pushBridgeEvent } from "@/lib/governance-bridge";
import { serializeSupportMessage, supportUser } from "@/lib/support";

// GET /api/support/tickets/:id/messages — the full conversation for one of the
// authenticated player's own tickets (ownership is enforced).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await supportUser();
  if (!user) return err("Sign in to contact support", 401);
  const { id } = await params;

  const ticket = await db.supportTicket.findFirst({ where: { id, userId: user.id } });
  if (!ticket) return err("Ticket not found", 404);

  const messages = await db.supportMessage.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: "asc" },
  });

  return ok({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status === "closed" ? "closed" : "open",
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
    },
    messages: messages.map(serializeSupportMessage),
  });
}

// POST /api/support/tickets/:id/messages — send a message from the player to the
// support agent. Persisted, pushed to Governance, and echoed over SSE.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await supportUser();
  if (!user) return err("Sign in to contact support", 401);
  const { id } = await params;

  const ticket = await db.supportTicket.findFirst({ where: { id, userId: user.id } });
  if (!ticket) return err("Ticket not found", 404);
  if (ticket.status === "closed") return err("This ticket is closed", 409);

  const body = await req.json().catch(() => null);
  const content = String(body?.message ?? "").trim().slice(0, 2000);
  if (!content) return err("Message is required", 400);

  const message = await db.supportMessage.create({
    data: { ticketId: ticket.id, sender: "player", author: user.username, content },
  });
  await db.supportTicket.update({ where: { id: ticket.id }, data: { status: "open" } });

  const wire = serializeSupportMessage(message);

  void pushBridgeEvent("casino.support_message", {
    ticketId: ticket.id,
    userId: user.id,
    username: user.username,
    subject: ticket.subject,
    message: wire,
  }).catch(() => {});

  publish({ event: "support:message", userId: user.id, data: { ticketId: ticket.id, message: wire } });

  return ok(wire, 201);
}
