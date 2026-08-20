import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/session";
import { publish } from "@/lib/realtime";
import { pushBridgeEvent } from "@/lib/governance-bridge";
import { serializeSupportMessage, supportUser, type SupportTicketWire } from "@/lib/support";

// GET /api/support/tickets — the authenticated player's support tickets,
// newest first, each with its latest message and lifecycle status.
export async function GET() {
  const user = await supportUser();
  if (!user) return err("Sign in to contact support", 401);
  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  const data: SupportTicketWire[] = tickets.map((t) => ({
    id: t.id,
    subject: t.subject,
    status: t.status === "closed" ? "closed" : "open",
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    lastMessage: t.messages[0] ? serializeSupportMessage(t.messages[0]) : null,
  }));

  return ok(data);
}

// POST /api/support/tickets — open a new support ticket. The first message is
// created inline, pushed to the Governance Tower so an agent can pick it up,
// and published over SSE so the UI updates immediately.
export async function POST(req: NextRequest) {
  const user = await supportUser();
  if (!user) return err("Sign in to contact support", 401);
  const body = await req.json().catch(() => null);
  if (!body) return err("Invalid body", 400);

  const subject = String(body.subject ?? "").trim().slice(0, 160);
  const content = String(body.message ?? "").trim().slice(0, 2000);
  if (!content) return err("Message is required", 400);

  const ticket = await db.supportTicket.create({
    data: { userId: user.id, subject: subject || "Support request", status: "open" },
  });

  const message = await db.supportMessage.create({
    data: { ticketId: ticket.id, sender: "player", author: user.username, content },
  });

  const wire = serializeSupportMessage(message);

  // Deliver to the Governance Tower for agent handling (best-effort — a bridge
  // outage must never block the player from opening a ticket).
  void pushBridgeEvent("casino.support_ticket", {
    ticketId: ticket.id,
    userId: user.id,
    username: user.username,
    subject: ticket.subject,
    message: wire,
  }).catch(() => {});

  publish({ event: "support:ticket", userId: user.id, data: { ticket: { id: ticket.id, status: "open", subject: ticket.subject } } });
  publish({ event: "support:message", userId: user.id, data: { ticketId: ticket.id, message: wire } });

  return ok({
    ticket: {
      id: ticket.id,
      subject: ticket.subject,
      status: "open",
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      lastMessage: wire,
    } satisfies SupportTicketWire,
    message: wire,
  }, 201);
}
