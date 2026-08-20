/*
 * Support live chat — shared serializers.
 *
 * Used by the API routes, the SSE realtime publisher and the Governance bridge
 * webhook so a support message is always shaped the same way on the wire,
 * regardless of which path produced it (player send, agent reply, history).
 */

export interface SupportMessageWire {
  id: string;
  ticketId: string;
  sender: "player" | "agent";
  author: string;
  content: string;
  createdAt: string;
}

export interface SupportTicketWire {
  id: string;
  subject: string;
  status: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  lastMessage: SupportMessageWire | null;
}

type MessageRow = {
  id: string;
  ticketId: string;
  sender: string;
  author: string;
  content: string;
  createdAt: Date;
};

export function serializeSupportMessage(m: MessageRow): SupportMessageWire {
  return {
    id: m.id,
    ticketId: m.ticketId,
    sender: m.sender === "agent" ? "agent" : "player",
    author: m.author,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

/**
 * Resolve the current support user, or null when unauthenticated. `getSession`
 * throws in production when there is no logged-in user; support routes must
 * return a clean 401 rather than a 500 for guests browsing the live-support
 * screen.
 */
export async function supportUser() {
  try {
    const { getSession } = await import("@/lib/session");
    return await getSession();
  } catch {
    return null;
  }
}
