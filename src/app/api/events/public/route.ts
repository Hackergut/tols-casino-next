import { subscribePublic, type PublicRealtimeEvent } from "@/lib/realtime";

/*
 * GET /api/events/public — the anonymous SSE stream.
 *
 * Everything a logged-out visitor is allowed to watch in real time arrives
 * here: the public bet feed (feed:bet), community chat (chat:message), the
 * jackpot ticker (jackpot:update) and big-win announcements (winner:new).
 * The private stream (/api/events) requires a session; this one deliberately
 * does not — the live feed scrolling past IS the storefront, and gating it
 * behind login would hide the product from the people deciding whether to
 * sign up.
 *
 * Payload discipline: nothing sent over this stream may identify a player
 * beyond the username they already publish by betting. That rule is enforced
 * where events are BUILT (settle-bet, casino-chat), not here — this route is
 * a dumb pipe by design so there is exactly one place to audit each payload.
 *
 * The 15s ping keeps intermediaries (Cloudflare, nginx, the Vercel proxy)
 * from reaping the connection as idle, and doubles as the disconnect
 * detector: enqueue() throws once the client is gone, which is when we
 * unsubscribe. `oncancel` alone is not reliable across runtimes.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsub();
      };

      const send = (e: PublicRealtimeEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
        } catch {
          close();
        }
      };

      const unsub = subscribePublic(send);
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          close();
        }
      }, 15000);

      controller.enqueue(encoder.encode(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`));
      cleanup = close;
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
