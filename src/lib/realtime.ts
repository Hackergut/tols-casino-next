/**
 * In-process event bus. Used by the SSE gateway so the browser can subscribe
 * to balance / round / auto-bet updates without polling. Swap the Map for
 * Redis pub/sub when the API is multi-instance.
 */

export type RealtimeEvent =
  | { event: "balance:update"; userId: string; data: { balance: number } }
  | { event: "round:started"; userId: string; data: Record<string, unknown> }
  | { event: "round:result"; userId: string; data: Record<string, unknown> }
  | { event: "auto-bet:status"; userId: string; data: Record<string, unknown> | object }
  | { event: "support:message"; userId: string; data: { ticketId: string; message: unknown } }
  | { event: "support:ticket"; userId: string; data: { ticket: unknown } }
  | { event: "error"; userId: string; data: { code: string; message?: string } };

type Handler = (e: RealtimeEvent) => void;

const listeners = new Set<Handler>();

export function publish(e: RealtimeEvent): void {
  for (const h of listeners) {
    try {
      h(e);
    } catch {
      /* isolate subscribers */
    }
  }
}

export function subscribe(h: Handler): () => void {
  listeners.add(h);
  return () => {
    listeners.delete(h);
  };
}
