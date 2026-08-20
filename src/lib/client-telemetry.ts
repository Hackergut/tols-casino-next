"use client";

/*
 * Client telemetry (telemetry-analytics skill).
 *
 * Fire-and-forget product events: navigate, game_open, auth, wallet_open…
 * Delivery uses navigator.sendBeacon (survives page unload) with a fetch
 * keepalive fallback. Events are buffered and flushed at most every 2s or 10
 * events so a frantic player can't flood the network. Never throws, never
 * blocks play — telemetry is best-effort by design.
 */

const FLUSH_MS = 2000;
const FLUSH_MAX = 10;

interface TelemetryEnvelope {
  event: string;
  props?: Record<string, unknown>;
  url?: string;
}

let queue: TelemetryEnvelope[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function sessionId(): string | null {
  try {
    if (!("sessionStorage" in window)) return null;
    let id = window.sessionStorage.getItem("tols:telemetry:session");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      window.sessionStorage.setItem("tols:telemetry:session", id);
    }
    return id;
  } catch {
    return null;
  }
}

function send(payload: TelemetryEnvelope[]): void {
  try {
    const body = JSON.stringify({
      events: payload,
      sessionId: sessionId(),
      url: typeof window !== "undefined" ? window.location.pathname : undefined,
      t: Date.now(),
    });
    if (navigator.sendBeacon) {
      const sent = navigator.sendBeacon("/api/telemetry", body);
      if (sent) return;
    }
    void fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* telemetry must never break the app */
  }
}

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  send(batch);
}

/** Record one product event. Safe to call anywhere, any time. */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    queue.push({ event: event.slice(0, 64), props, url: typeof window !== "undefined" ? window.location.pathname : undefined });
    if (queue.length >= FLUSH_MAX) {
      flush();
    } else if (!timer) {
      timer = setTimeout(flush, FLUSH_MS);
    }
  } catch {
    /* ignore */
  }
}

// Flush whatever is queued when the page goes away.
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush, { once: true });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
