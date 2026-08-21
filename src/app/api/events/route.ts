import { getSession, err } from "@/lib/session";
import { subscribe, type RealtimeEvent } from "@/lib/realtime";

/*
 * GET /api/events — the authenticated per-player SSE stream.
 *
 * Delivers everything private: balance moves, round results, bonus state,
 * auto-bet status, support replies. Events are filtered by userId at the
 * subscription boundary so one player's stream can never carry another's
 * money.
 *
 * Disconnect handling matters more here than anywhere else: every open game
 * tab holds one of these streams, and a leaked subscription keeps its closure
 * (and the response controller) alive forever. enqueue() throwing after the
 * client goes away is the reliable disconnect signal across runtimes;
 * `cancel()` fires when the runtime supports it. Both funnel into one
 * idempotent close().
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  const userId = user.id;

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

      const send = (e: RealtimeEvent) => {
        if (closed || e.userId !== userId) return;
        try {
          controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
        } catch {
          close();
        }
      };

      const unsub = subscribe(send);
      const ping = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          close();
        }
      }, 15000);

      controller.enqueue(encoder.encode(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`));
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
