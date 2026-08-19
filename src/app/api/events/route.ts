import { getSession, err } from "@/lib/session";
import { subscribe, type RealtimeEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await getSession();
  } catch {
    return err("Not authenticated", 401);
  }
  const userId = user.id;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (e: RealtimeEvent) => {
        if (e.userId !== userId) return;
        controller.enqueue(encoder.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
      };
      const unsub = subscribe(send);
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: {}\n\n`));
        } catch {
          clearInterval(ping);
        }
      }, 15000);
      controller.enqueue(encoder.encode(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`));
      const cancel = () => {
        clearInterval(ping);
        unsub();
      };
      (controller as unknown as { oncancel?: () => void }).oncancel = cancel;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
