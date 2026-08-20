# Support Live Chat — Casino ↔ Governance bridge

Player-facing live support, bridged to the Governance Tower over the existing
service-to-service HTTPS bridge (HMAC + JWT RS256). A player opens a ticket in
the casino and every message flows to Governance; agent replies come back and
are delivered to the player in real time over SSE.

## Data model (Prisma)

- `SupportTicket` — one per player support request (`open` | `closed`).
- `SupportMessage` — each message in a ticket, `sender` is `player` or `agent`.

Apply with `npm run db:push` (schema is committed; the Vercel build runs
`prisma generate`).

## Flow

```
 Player (casino UI)                      Casino API                      Governance Tower
        │                                    │                                  │
        │ POST /api/support/tickets          │                                  │
        │ ─────────────────────────────────► │  pushBridgeEvent("casino.support_ticket")
        │                                    │ ────────────────────────────────►│
        │ POST /api/support/tickets/:id/msgs │                                  │
        │ ─────────────────────────────────► │  pushBridgeEvent("casino.support_message")
        │                                    │ ────────────────────────────────►│
        │                                    │                                  │
        │                                    │  POST /api/bridge/webhook        │
        │                                    │ ◄────────────────────────────────│
        │  SSE "support:message"             │  (governance.support_reply)      │
        │ ◄───────────────────────────────── │  persist + publish()             │
```

## Casino → Governance (outbound)

The casino pushes two events using the existing `pushBridgeEvent()` (same
webhook delivery + HMAC signing as every other bridge event):

| Event | Payload |
|---|---|
| `casino.support_ticket` | `{ ticketId, userId, username, subject, message }` |
| `casino.support_message` | `{ ticketId, userId, username, subject, message }` |

`message` is the serialized `SupportMessageWire` (`{ id, ticketId, sender, author, content, createdAt }`).

## Governance → Casino (inbound)

Governance POSTs to `POST /api/bridge/webhook` (HMAC `X-Bridge-Signature`,
same as the other governance commands):

| Event | Payload | Effect |
|---|---|---|
| `governance.support_reply` | `{ ticketId, userId, content, agentName? }` | Persists an agent message, publishes `support:message` SSE to the player, reopens the ticket |
| `governance.support_close` | `{ ticketId, userId }` | Marks the ticket `closed`, publishes `support:ticket` SSE |

These are already registered in `isKnownInboundType()` and handled in
`src/app/api/bridge/webhook/route.ts`.

## Real-time (SSE)

- `src/lib/realtime.ts` — added `support:message` and `support:ticket` events.
- `GET /api/events` — the existing SSE gateway forwards them to the matching
  player (in-process bus; swap for Redis pub/sub for multi-instance, same as
  the existing balance events).

## Operator surface (this repo)

The same reply path is exposed for the in-repo admin so the loop is testable
without the Tower, and as a reference implementation for the Governance UI:

- `GET /api/admin/support/tickets` — operator inbox (all tickets).
- `GET /api/admin/support/tickets/:id` — ticket + conversation.
- `POST /api/admin/support/tickets/:id` — `{ message }` to reply as agent, or
  `{ action: "close" }` to close.

## Player endpoints

- `GET /api/support/tickets` — the player's tickets.
- `POST /api/support/tickets` — `{ subject?, message }` opens a ticket.
- `GET /api/support/tickets/:id/messages` — conversation (ownership enforced).
- `POST /api/support/tickets/:id/messages` — `{ message }` sends a message.

## UI

- `src/components/lobby/SupportChat.tsx` — self-contained chat (ticket list,
  conversation, composer, SSE subscription).
- Rendered inside the **Live Support** profile section.
